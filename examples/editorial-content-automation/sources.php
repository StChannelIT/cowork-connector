<?php
/**
 * sources.php — registry of sources to monitor (editorial domain example)
 * -------------------------------------------------------------------------
 * Optional route, independent from core/tasks.php: keeps a registry of
 * blogs, creators, channels to watch for content scouting. Same
 * token-authentication pattern as core/tasks.php.
 *
 * Setup: replace AUTH_TOKEN, upload it next to (or inside) your domain.
 */

const AUTH_TOKEN = 'CHANGE_THIS_LONG_RANDOM_TOKEN';
const DB_FILE     = __DIR__ . '/cowork_sources.db';

header('Content-Type: application/json; charset=utf-8');

$provided = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? ($_GET['token'] ?? '');
if (!is_string($provided) || $provided === '' || !hash_equals(AUTH_TOKEN, $provided)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']);
    exit;
}

try {
    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'db_connect', 'detail' => $e->getMessage()]);
    exit;
}

$pdo->exec("CREATE TABLE IF NOT EXISTS sources (
    name       TEXT PRIMARY KEY,
    kind       TEXT,
    tags       TEXT DEFAULT '[]',
    topics     TEXT,
    lang       TEXT,
    active     INTEGER DEFAULT 1,
    priority   INTEGER DEFAULT 50,
    refs       TEXT DEFAULT '[]',
    source     TEXT,
    updated_at TEXT
);");

function now_iso() { return gmdate('Y-m-d\TH:i:s\Z'); }
function req_body() {
    $j = json_decode(file_get_contents('php://input'), true);
    return is_array($j) ? $j : $_POST;
}

$action = $_GET['action'] ?? 'list';

try {
    switch ($action) {

    case 'list': {
        $where = ['1=1']; $params = [];
        if (($_GET['active'] ?? '') === '1') $where[] = 'active=1';
        if (!empty($_GET['tag'])) { $where[] = "tags LIKE :tag"; $params[':tag'] = '%"' . $_GET['tag'] . '"%'; }
        $sql = "SELECT * FROM sources WHERE " . implode(' AND ', $where) . " ORDER BY priority DESC, name";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = array_map(function ($r) {
            $r['tags'] = json_decode($r['tags'], true) ?? [];
            $r['refs'] = json_decode($r['refs'], true) ?? [];
            $r['active'] = (bool)$r['active'];
            return $r;
        }, $rows);
        echo json_encode(['ok' => true, 'count' => count($out), 'sources' => $out], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;
    }

    // Upsert: dedup on "name". Merges tags, only adds new refs (by url/handle).
    case 'ingest': {
        $b = req_body();
        $created = 0; $updated = 0;
        $sel = $pdo->prepare("SELECT * FROM sources WHERE name=:n");
        foreach (($b['sources'] ?? []) as $s) {
            if (empty($s['name'])) continue;
            $sel->execute([':n' => $s['name']]);
            $existing = $sel->fetch(PDO::FETCH_ASSOC);

            $tags = $s['tags'] ?? [];
            $refs = $s['refs'] ?? [];

            if ($existing) {
                $tags = array_values(array_unique(array_merge(json_decode($existing['tags'], true) ?? [], $tags)));
                $existing_refs = json_decode($existing['refs'], true) ?? [];
                $known = array_map(fn($r) => ($r['url'] ?? '') . '|' . ($r['handle'] ?? ''), $existing_refs);
                foreach ($refs as $r) {
                    $key = ($r['url'] ?? '') . '|' . ($r['handle'] ?? '');
                    if (!in_array($key, $known, true)) $existing_refs[] = $r;
                }
                $refs = $existing_refs;
                $updated++;
            } else {
                $created++;
            }

            $pdo->prepare(
                "INSERT INTO sources (name, kind, tags, topics, lang, active, priority, refs, source, updated_at)
                 VALUES (:name,:kind,:tags,:topics,:lang,:active,:priority,:refs,:source,:t)
                 ON CONFLICT(name) DO UPDATE SET
                   kind=excluded.kind, tags=excluded.tags, topics=excluded.topics, lang=excluded.lang,
                   active=excluded.active, priority=excluded.priority, refs=excluded.refs,
                   source=excluded.source, updated_at=excluded.updated_at"
            )->execute([
                ':name' => $s['name'], ':kind' => $s['kind'] ?? null,
                ':tags' => json_encode($tags, JSON_UNESCAPED_UNICODE),
                ':topics' => $s['topics'] ?? null, ':lang' => $s['lang'] ?? null,
                ':active' => !empty($s['active']) ? 1 : 0, ':priority' => (int)($s['priority'] ?? 50),
                ':refs' => json_encode($refs, JSON_UNESCAPED_UNICODE),
                ':source' => $b['source'] ?? null, ':t' => now_iso(),
            ]);
        }
        echo json_encode(['ok' => true, 'created' => $created, 'updated' => $updated]);
        break;
    }

    default:
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'unknown_action']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server', 'detail' => $e->getMessage()]);
}
