<?php
/**
 * Cowork Connector — task queue API route (SQLite + token)
 * -------------------------------------------------------------------
 * Exposes a generic task queue: whoever wants to automate something writes
 * to it (action=add, or directly into the DB from your own CMS/script),
 * Claude in Cowork reads it (action=next) and writes the outcome back with
 * one of the closing actions (complete / derive_complete / voice_complete /
 * asset_complete / cover / ingest / fail).
 *
 * Server requirements: PHP 7.4+ with the pdo_sqlite extension (available by
 * default almost everywhere).
 *
 * Security: every request must include the token, via header
 *   X-Auth-Token: <token>   or   ?token=<token>
 *
 * Setup:
 *   1. Replace AUTH_TOKEN below with a long, random token.
 *   2. Upload this file to a web space PHP can write to.
 *   3. (Recommended) put the .db file this script creates outside the web
 *      root, or deny direct HTTP access to it at the server level
 *      (.htaccess/nginx).
 */

// ============ CONFIG (TO CHANGE) ============
const AUTH_TOKEN        = 'CHANGE_THIS_LONG_RANDOM_TOKEN';
const DB_FILE            = __DIR__ . '/cowork_tasks.db';
const COVERS_DIR         = __DIR__ . '/covers';
const ASSETS_DIR         = __DIR__ . '/assets';
const MAX_UPLOAD_BYTES   = 10 * 1024 * 1024; // 10 MB, limit on base64 payloads
// ================================================

header('Content-Type: application/json; charset=utf-8');

// ---- Authentication ----
$provided = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? ($_SERVER['HTTP_X_RADAR_TOKEN'] ?? ($_GET['token'] ?? ''));
if (!is_string($provided) || $provided === '' || !hash_equals(AUTH_TOKEN, $provided)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']);
    exit;
}

// ---- Connection + schema ----
try {
    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode=WAL;');
    $pdo->exec('PRAGMA busy_timeout=5000;');
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'db_connect', 'detail' => $e->getMessage()]);
    exit;
}

$pdo->exec("CREATE TABLE IF NOT EXISTS tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    domain        TEXT,
    prompt        TEXT    NOT NULL,
    target_folder TEXT,
    action_type   TEXT    NOT NULL DEFAULT 'generate',
    params        TEXT    DEFAULT '{}',
    priority      INTEGER NOT NULL DEFAULT 5,
    status        TEXT    NOT NULL DEFAULT 'pending',
    attempts      INTEGER NOT NULL DEFAULT 0,
    max_attempts  INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL,
    started_at    TEXT,
    finished_at   TEXT,
    result_md     TEXT,
    meta          TEXT,
    cover_file    TEXT,
    cover_url     TEXT,
    cover_prompt  TEXT,
    error         TEXT
);");
$pdo->exec("CREATE INDEX IF NOT EXISTS idx_tasks_status_prio ON tasks(status, priority, id);");

$pdo->exec("CREATE TABLE IF NOT EXISTS derivatives (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id       INTEGER NOT NULL,
    derivative_id INTEGER NOT NULL DEFAULT 0,
    content_md    TEXT,
    content_json  TEXT,
    meta          TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT,
    UNIQUE(task_id, derivative_id)
);");

$pdo->exec("CREATE TABLE IF NOT EXISTS voice_profiles (
    scope       TEXT PRIMARY KEY,
    mode        TEXT,
    profile_md  TEXT,
    updated_at  TEXT NOT NULL
);");

$pdo->exec("CREATE TABLE IF NOT EXISTS assets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id       INTEGER NOT NULL,
    derivative_id INTEGER NOT NULL DEFAULT 0,
    kind          TEXT,
    label         TEXT,
    prompt        TEXT,
    file_path     TEXT,
    url           TEXT,
    created_at    TEXT NOT NULL
);");

$pdo->exec("CREATE TABLE IF NOT EXISTS candidates (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id         INTEGER NOT NULL,
    source_title   TEXT NOT NULL,
    source_url     TEXT,
    source_excerpt TEXT,
    topic          TEXT,
    section        TEXT,
    subsection     TEXT,
    cluster        TEXT,
    score          INTEGER,
    score_reason   TEXT,
    angle          TEXT,
    target         TEXT,
    dup_status     TEXT DEFAULT 'new',
    created_at     TEXT NOT NULL
);");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now_iso() { return gmdate('Y-m-d\TH:i:s\Z'); }

function req_body() {
    $raw = file_get_contents('php://input');
    $j = json_decode($raw, true);
    if (is_array($j)) return $j;
    return $_POST;
}

function json_col($v) {
    if ($v === null) return null;
    return is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE);
}

function json_out($v) {
    if ($v === null || $v === '') return null;
    $d = json_decode($v, true);
    return $d === null && $v !== 'null' ? $v : $d;
}

/** Decode a base64 image (with or without a data URI prefix) and save it to disk. */
function save_base64_image($b64, $dir, $basename) {
    if (strpos($b64, ',') !== false && stripos($b64, 'base64') !== false) {
        $b64 = substr($b64, strpos($b64, ',') + 1);
    }
    $bytes = base64_decode($b64, true);
    if ($bytes === false) throw new RuntimeException('invalid base64');
    if (strlen($bytes) > MAX_UPLOAD_BYTES) throw new RuntimeException('file too large');

    $ext = 'jpg';
    if (substr($bytes, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = 'png';
    elseif (substr($bytes, 0, 3) === "\xFF\xD8\xFF") $ext = 'jpg';
    elseif (substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP') $ext = 'webp';

    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $path = rtrim($dir, '/') . '/' . $basename . '.' . $ext;
    file_put_contents($path, $bytes);
    return [$path, strlen($bytes), $ext];
}

$action = $_GET['action'] ?? 'next';

try {
    switch ($action) {

    // ================= next: atomic claim pending -> running =================
    case 'next': {
        $limit = (int)($_GET['limit'] ?? 5);
        if ($limit < 1) $limit = 1;
        $pdo->exec('BEGIN IMMEDIATE;');
        $stmt = $pdo->prepare(
            "SELECT * FROM tasks
             WHERE status='pending' AND attempts < max_attempts
             ORDER BY priority ASC, id ASC LIMIT :lim");
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $upd = $pdo->prepare(
            "UPDATE tasks SET status='running', started_at=:t, attempts=attempts+1 WHERE id=:id");
        $out = [];
        foreach ($rows as $r) {
            $upd->execute([':t' => now_iso(), ':id' => $r['id']]);
            $out[] = [
                'id'            => (int)$r['id'],
                'domain'        => $r['domain'],
                'prompt'        => $r['prompt'],
                'target_folder' => $r['target_folder'],
                'action_type'   => $r['action_type'],
                'params'        => json_out($r['params']) ?? new stdClass(),
                'priority'      => (int)$r['priority'],
                'attempt'       => (int)$r['attempts'] + 1,
                'max_attempts'  => (int)$r['max_attempts'],
            ];
        }
        $pdo->exec('COMMIT;');
        echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;
    }

    // ================= add: inserts a new task =================
    case 'add': {
        $b = req_body();
        if (empty($b['prompt'])) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'prompt_required']); break; }
        $stmt = $pdo->prepare(
            "INSERT INTO tasks (domain, prompt, target_folder, action_type, params, priority, max_attempts, status, created_at)
             VALUES (:dom, :p, :f, :a, :par, :pri, :ma, 'pending', :c)");
        $stmt->execute([
            ':dom' => $b['domain'] ?? null,
            ':p'   => $b['prompt'],
            ':f'   => $b['target_folder'] ?? null,
            ':a'   => $b['action_type'] ?? 'generate',
            ':par' => json_col($b['params'] ?? new stdClass()),
            ':pri' => (int)($b['priority'] ?? 5),
            ':ma'  => (int)($b['max_attempts'] ?? 1),
            ':c'   => now_iso(),
        ]);
        echo json_encode(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
        break;
    }

    // ================= complete: positive outcome for generate/revise =================
    case 'complete': {
        $b = req_body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'id_required']); break; }
        $result_md = $b['result_md'] ?? $b['markdown'] ?? $b['log'] ?? null;
        $meta = $b['meta'] ?? null;
        if ($meta === null && isset($b['social_text'])) $meta = ['social_text' => $b['social_text']];
        elseif (is_array($meta) && isset($b['social_text']) && !isset($meta['social_text'])) $meta['social_text'] = $b['social_text'];

        $pdo->prepare("UPDATE tasks SET status='done', finished_at=:t, result_md=:r, meta=:m WHERE id=:id")
            ->execute([':t' => now_iso(), ':r' => $result_md, ':m' => json_col($meta), ':id' => $id]);
        echo json_encode(['ok' => true, 'id' => $id, 'status' => 'done']);
        break;
    }

    // ================= derive_complete: closes a "derive"/"der_revise" task =================
    case 'derive_complete': {
        $b = req_body();
        $id  = (int)($b['id'] ?? 0);
        $did = (int)($b['derivative_id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'id_required']); break; }

        $pdo->prepare(
            "INSERT INTO derivatives (task_id, derivative_id, content_md, content_json, meta, created_at, updated_at)
             VALUES (:tid, :did, :md, :cj, :m, :c, :c)
             ON CONFLICT(task_id, derivative_id) DO UPDATE SET
               content_md=excluded.content_md, content_json=excluded.content_json,
               meta=excluded.meta, updated_at=excluded.updated_at"
        )->execute([
            ':tid' => $id, ':did' => $did,
            ':md'  => $b['content_md'] ?? null,
            ':cj'  => json_col($b['content_json'] ?? null),
            ':m'   => json_col($b['meta'] ?? null),
            ':c'   => now_iso(),
        ]);
        $pdo->prepare("UPDATE tasks SET status='done', finished_at=:t WHERE id=:id")
            ->execute([':t' => now_iso(), ':id' => $id]);
        echo json_encode(['ok' => true, 'id' => $id, 'derivative_id' => $did, 'status' => 'done']);
        break;
    }

    // ================= voice_complete: updates a persistent profile =================
    case 'voice_complete': {
        $b = req_body();
        $id    = (int)($b['id'] ?? 0);
        $scope = $b['scope'] ?? 'global';
        $mode  = $b['mode']  ?? 'seed';
        if (!$id) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'id_required']); break; }

        $pdo->prepare(
            "INSERT INTO voice_profiles (scope, mode, profile_md, updated_at)
             VALUES (:s, :m, :p, :t)
             ON CONFLICT(scope) DO UPDATE SET mode=excluded.mode, profile_md=excluded.profile_md, updated_at=excluded.updated_at"
        )->execute([':s' => $scope, ':m' => $mode, ':p' => $b['profile_md'] ?? '', ':t' => now_iso()]);

        $pdo->prepare("UPDATE tasks SET status='done', finished_at=:t WHERE id=:id")
            ->execute([':t' => now_iso(), ':id' => $id]);
        echo json_encode(['ok' => true, 'id' => $id, 'scope' => $scope, 'mode' => $mode, 'status' => 'done']);
        break;
    }

    // ================= asset_complete: delivers real assets (images/video/files) =================
    case 'asset_complete': {
        $b = req_body();
        $id  = (int)($b['id'] ?? 0);
        $did = (int)($b['derivative_id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'id_required']); break; }

        $saved = [];
        foreach (($b['assets'] ?? []) as $i => $a) {
            $file_path = null; $url = null;
            if (!empty($a['data_base64'])) {
                [$file_path, $bytes, $ext] = save_base64_image($a['data_base64'], ASSETS_DIR, "task{$id}-der{$did}-{$i}");
            } elseif (!empty($a['url'])) {
                $url = $a['url'];
            }
            $pdo->prepare(
                "INSERT INTO assets (task_id, derivative_id, kind, label, prompt, file_path, url, created_at)
                 VALUES (:tid, :did, :kind, :label, :prompt, :fp, :url, :c)"
            )->execute([
                ':tid' => $id, ':did' => $did,
                ':kind' => $a['kind'] ?? null, ':label' => $a['label'] ?? null, ':prompt' => $a['prompt'] ?? null,
                ':fp' => $file_path, ':url' => $url, ':c' => now_iso(),
            ]);
            $saved[] = ['kind' => $a['kind'] ?? null, 'file' => $file_path, 'url' => $url];
        }
        $pdo->prepare("UPDATE tasks SET status='done', finished_at=:t WHERE id=:id")
            ->execute([':t' => now_iso(), ':id' => $id]);
        echo json_encode(['ok' => true, 'id' => $id, 'derivative_id' => $did, 'status' => 'done', 'saved' => $saved]);
        break;
    }

    // ================= cover: delivers a cover image =================
    case 'cover': {
        $b = req_body();
        $id = (int)($b['draft_id'] ?? $b['id'] ?? $b['job_id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'draft_id_required']); break; }

        $b64 = $b['data_base64'] ?? $b['data'] ?? $b['image_base64'] ?? null;
        $url = $b['cover_url'] ?? $b['url'] ?? $b['cover_image'] ?? $b['image_url'] ?? null;
        $prompt = $b['cover_prompt'] ?? null;

        if ($b64) {
            try {
                [$path, $bytes, $ext] = save_base64_image($b64, COVERS_DIR, "cover-{$id}");
            } catch (Throwable $e) {
                http_response_code(422); echo json_encode(['ok' => false, 'error' => 'invalid_image', 'detail' => $e->getMessage()]); break;
            }
            $pdo->prepare("UPDATE tasks SET cover_file=:f, cover_prompt=:p WHERE id=:id")
                ->execute([':f' => $path, ':p' => $prompt, ':id' => $id]);
            echo json_encode(['ok' => true, 'id' => $id, 'cover_file' => $path, 'bytes' => $bytes]);
        } elseif ($url) {
            // Note: only the URL reference is stored here, it isn't downloaded
            // server-side (avoids SSRF risk on a public endpoint). If you need
            // the file downloaded server-side, add the fetch yourself with an
            // allowlist of permitted domains/mime types.
            $pdo->prepare("UPDATE tasks SET cover_url=:u, cover_prompt=:p WHERE id=:id")
                ->execute([':u' => $url, ':p' => $prompt, ':id' => $id]);
            echo json_encode(['ok' => true, 'id' => $id, 'cover_url' => $url]);
        } else {
            http_response_code(422); echo json_encode(['ok' => false, 'error' => 'missing_data_or_url']);
        }
        break;
    }

    // ================= ingest: candidates from a "scout" task =================
    case 'ingest': {
        $b = req_body();
        $job_id = (int)($b['job_id'] ?? 0);
        if (!$job_id) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'job_id_required']); break; }

        $inserted = 0; $updated = 0; $skipped = 0; $results = [];
        $chk = $pdo->prepare("SELECT id FROM candidates WHERE job_id != :jid AND source_url = :url AND source_url != '' LIMIT 1");
        foreach (($b['candidates'] ?? []) as $c) {
            if (empty($c['source_title'])) { $skipped++; continue; }
            $dup = 'new';
            if (!empty($c['source_url'])) {
                $chk->execute([':jid' => $job_id, ':url' => $c['source_url']]);
                if ($chk->fetch()) $dup = 'duplicate';
            }
            $pdo->prepare(
                "INSERT INTO candidates (job_id, source_title, source_url, source_excerpt, topic, section, subsection, cluster, score, score_reason, angle, target, dup_status, created_at)
                 VALUES (:jid,:st,:su,:se,:topic,:sec,:sub,:cl,:sc,:sr,:ang,:tg,:dup,:c)"
            )->execute([
                ':jid' => $job_id, ':st' => $c['source_title'], ':su' => $c['source_url'] ?? null,
                ':se' => $c['source_excerpt'] ?? null, ':topic' => $c['topic'] ?? null,
                ':sec' => $c['section'] ?? null, ':sub' => $c['subsection'] ?? null, ':cl' => $c['cluster'] ?? null,
                ':sc' => $c['score'] ?? null, ':sr' => $c['score_reason'] ?? null,
                ':ang' => $c['angle'] ?? null, ':tg' => $c['target'] ?? null,
                ':dup' => $dup, ':c' => now_iso(),
            ]);
            if ($dup === 'duplicate') { $updated++; } else { $inserted++; }
            $results[] = ['source_title' => $c['source_title'], 'status' => $dup];
        }
        $pdo->prepare("UPDATE tasks SET status='done', finished_at=:t WHERE id=:id")
            ->execute([':t' => now_iso(), ':id' => $job_id]);
        echo json_encode([
            'ok' => true, 'job_id' => $job_id,
            'received' => $inserted + $updated + $skipped, 'inserted' => $inserted,
            'updated' => $updated, 'skipped' => $skipped, 'results' => $results,
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ================= fail: negative outcome (retry if attempts remain) =================
    case 'fail': {
        $b = req_body();
        $id  = (int)($b['id'] ?? 0);
        $err = (string)($b['error'] ?? '');
        $sel = $pdo->prepare("SELECT attempts, max_attempts FROM tasks WHERE id=:id");
        $sel->execute([':id' => $id]);
        $r = $sel->fetch(PDO::FETCH_ASSOC);
        if (!$r) { http_response_code(404); echo json_encode(['ok' => false, 'error' => 'not_found']); break; }
        $new = ((int)$r['attempts'] < (int)$r['max_attempts']) ? 'pending' : 'error';
        $pdo->prepare("UPDATE tasks SET status=:s, finished_at=:t, error=:e WHERE id=:id")
            ->execute([':s' => $new, ':t' => now_iso(), ':e' => $err, ':id' => $id]);
        echo json_encode(['ok' => true, 'id' => $id, 'status' => $new]);
        break;
    }

    // ================= status: detail of a single task =================
    case 'status': {
        $id = (int)($_GET['draft_id'] ?? $_GET['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM tasks WHERE id=:id");
        $stmt->execute([':id' => $id]);
        $t = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$t) { http_response_code(404); echo json_encode(['ok' => false, 'error' => 'not_found']); break; }
        $t['params'] = json_out($t['params']);
        $t['meta']   = json_out($t['meta']);

        $d = $pdo->prepare("SELECT derivative_id, content_md, content_json, meta, updated_at FROM derivatives WHERE task_id=:id");
        $d->execute([':id' => $id]);
        $derivatives = $d->fetchAll(PDO::FETCH_ASSOC);

        $a = $pdo->prepare("SELECT kind, label, file_path, url FROM assets WHERE task_id=:id");
        $a->execute([':id' => $id]);
        $assets = $a->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['ok' => true, 'task' => $t, 'derivatives' => $derivatives, 'assets' => $assets], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;
    }

    // ================= recent: most recently closed tasks =================
    case 'recent': {
        $limit = (int)($_GET['limit'] ?? 10);
        $stmt = $pdo->prepare(
            "SELECT id, domain, action_type, status, priority, finished_at, substr(coalesce(result_md,''),1,120) AS excerpt
             FROM tasks WHERE status IN ('done','error') ORDER BY finished_at DESC LIMIT :lim");
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;
    }

    // ================= list: summary listing (debug) =================
    case 'list': {
        $rows = $pdo->query(
            "SELECT id, status, priority, action_type, target_folder, substr(prompt,1,80) AS prompt
             FROM tasks ORDER BY status, priority, id")->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;
    }

    // ================= stats: count by status =================
    case 'stats': {
        $rows = $pdo->query("SELECT status, COUNT(*) c FROM tasks GROUP BY status")
                    ->fetchAll(PDO::FETCH_KEY_PAIR);
        echo json_encode($rows, JSON_PRETTY_PRINT);
        break;
    }

    default:
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'unknown_action', 'action' => $action]);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server', 'detail' => $e->getMessage()]);
}
