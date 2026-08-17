<?php
/**
 * GEDCOM 5.5 / 5.5.1 parser (PHP).
 * Mirrors the behaviour of src/utils/gedcomParser.js in the React app.
 * Produces a normalized array: individuals[], families[], plus extras.
 */

declare(strict_types=1);

class GEDCOMParser
{
    /** @var array<string,array> */
    private array $individuals = [];

    /** @var array<string,array> */
    private array $families = [];

    /** @var array<string,array> */
    private array $sources = [];

    /** @var array<string,array> */
    private array $repositories = [];

    /** @var array<string,array> */
    private array $media = [];

    /** @var array<string,string> */
    private array $notes = [];

    /** @var array<string,array> */
    private array $submitters = [];

    private array $header = [];

    private array $errors = [];

    public function parse(string $content): array
    {
        $this->individuals = [];
        $this->families = [];
        $this->sources = [];
        $this->repositories = [];
        $this->media = [];
        $this->notes = [];
        $this->submitters = [];
        $this->header = [];
        $this->errors = [];

        $root = $this->parseLines($content);
        if (count($root) === 0) {
            $this->errors[] = 'No valid GEDCOM lines found';
            return $this->result();
        }

        $this->processRecords($root);
        $this->buildRelationships();

        return $this->result();
    }

    /** Split raw text into a line tree (level, xref, tag, value, children). */
    private function parseLines(string $content): array
    {
        $lines = [];
        foreach (preg_split('/\r?\n/', $content) as $lineNo => $rawLine) {
            $rawLine = trim($rawLine);
            if ($rawLine === '') continue;

            if (!preg_match('/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/', $rawLine, $m)) {
                if (str_starts_with($rawLine, '+') && count($lines) > 0) {
                    $lastIdx = count($lines) - 1;
                    $lines[$lastIdx]['value'] .= substr($rawLine, 1);
                }
                continue;
            }

            $lines[] = [
                'level' => (int) $m[1],
                'xref'  => ($m[2] ?? null) ? trim($m[2]) : null,
                'tag'   => $m[3],
                'value' => isset($m[4]) ? trim($m[4]) : '',
                'children' => [],
                'lineNumber' => $lineNo + 1,
            ];
        }

        // Build tree (references so children propagate to root)
        $root = [];
        $stack = [];
        foreach ($lines as $line) {
            while (count($stack) > 0 && end($stack)['level'] >= $line['level']) {
                array_pop($stack);
            }
            $node = $line;
            if (count($stack) === 0) {
                $root[] = &$node;
            } else {
                $parent = &$stack[count($stack) - 1];
                $parent['children'][] = &$node;
            }
            $stack[] = &$node;
            unset($node);
        }

        return $root;
    }

    private function processRecords(array $root): void
    {
        foreach ($root as $line) {
            switch ($line['tag']) {
                case 'HEAD': $this->processHeader($line); break;
                case 'INDI': $this->processIndividual($line); break;
                case 'FAM':  $this->processFamily($line); break;
                case 'SOUR': $this->processSource($line); break;
                case 'REPO': $this->processRepository($line); break;
                case 'OBJE': $this->processMedia($line); break;
                case 'NOTE': $this->processNote($line); break;
                case 'SUBM': $this->processSubmitter($line); break;
                // TRLR / unknown top-level: ignored
            }
        }
    }

    private function processHeader(array $line): void
    {
        $header = [];
        foreach ($line['children'] as $child) {
            switch ($child['tag']) {
                case 'SOUR':
                    $header['source'] = $child['value'];
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'NAME') $header['sourceName'] = $sub['value'];
                        if ($sub['tag'] === 'VERS') $header['sourceVersion'] = $sub['value'];
                        if ($sub['tag'] === 'CORP') $header['sourceCorp'] = $sub['value'];
                    }
                    break;
                case 'DEST': $header['destination'] = $child['value']; break;
                case 'DATE': $header['date'] = $child['value']; break;
                case 'FILE': $header['file'] = $child['value']; break;
                case 'GEDC':
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'VERS') $header['gedcomVersion'] = $sub['value'];
                        if ($sub['tag'] === 'FORM') $header['gedcomForm'] = $sub['value'];
                    }
                    break;
                case 'CHAR': $header['characterSet'] = $child['value']; break;
                case 'LANG': $header['language'] = $child['value']; break;
                case 'SUBM': $header['submitter'] = $child['value']; break;
            }
        }
        $this->header = $header;
    }

    private function processIndividual(array $line): void
    {
        $id = $line['xref'] ?? ('I' . (count($this->individuals) + 1));
        $ind = [
            'id' => $id,
            'name' => '',
            'givenName' => '',
            'surname' => '',
            'prefix' => '',
            'suffix' => '',
            'nickname' => '',
            'gender' => 'unknown',
            'birthDate' => '',
            'birthPlace' => '',
            'deathDate' => '',
            'deathPlace' => '',
            'burialDate' => '',
            'burialPlace' => '',
            'occupation' => '',
            'education' => '',
            'religion' => '',
            'photo' => '',
            'notes' => [],
            'sources' => [],
            'media' => [],
            'events' => [],
            'familyIds' => [],
            'parentFamilyIds' => [],
            'spouseFamilyIds' => [],
            'parents' => [],
            'spouses' => [],
            'children' => [],
            'siblings' => [],
        ];

        foreach ($line['children'] as $child) {
            switch ($child['tag']) {
                case 'NAME':
                    $ind['name'] = $child['value'];
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'GIVN') $ind['givenName'] = $sub['value'];
                        if ($sub['tag'] === 'SURN') $ind['surname'] = $sub['value'];
                        if ($sub['tag'] === 'NPFX') $ind['prefix'] = $sub['value'];
                        if ($sub['tag'] === 'NSFX') $ind['suffix'] = $sub['value'];
                        if ($sub['tag'] === 'NICK') $ind['nickname'] = $sub['value'];
                    }
                    if ($ind['givenName'] === '' && $ind['surname'] === '' && $ind['name'] !== '') {
                        $parts = explode('/', $ind['name']);
                        if (count($parts) >= 2) {
                            $ind['givenName'] = trim($parts[0]);
                            $ind['surname'] = trim($parts[1]);
                        }
                    }
                    break;
                case 'SEX':
                    $g = strtolower($child['value']);
                    $ind['gender'] = $g === 'm' ? 'male' : ($g === 'f' ? 'female' : 'unknown');
                    break;
                case 'BIRT':
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'DATE') $ind['birthDate'] = $sub['value'];
                        if ($sub['tag'] === 'PLAC') $ind['birthPlace'] = $sub['value'];
                    }
                    break;
                case 'DEAT':
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'DATE') $ind['deathDate'] = $sub['value'];
                        if ($sub['tag'] === 'PLAC') $ind['deathPlace'] = $sub['value'];
                    }
                    break;
                case 'BURI':
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'DATE') $ind['burialDate'] = $sub['value'];
                        if ($sub['tag'] === 'PLAC') $ind['burialPlace'] = $sub['value'];
                    }
                    break;
                case 'OCCU': $ind['occupation'] = $child['value']; break;
                case 'EDUC': $ind['education'] = $child['value']; break;
                case 'RELI': $ind['religion'] = $child['value']; break;
                case 'NOTE': $ind['notes'][] = $child['value']; break;
                case 'SOUR': $ind['sources'][] = $child['value']; break;
                case 'OBJE':
                    $ind['media'][] = $child['value'];
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'FILE') $ind['photo'] = $sub['value'];
                        if ($sub['tag'] === 'BLOB') $ind['photo'] = $sub['value'];
                    }
                    break;
                case '_PHOTO':
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'FILE') $ind['photo'] = $sub['value'];
                        if ($sub['tag'] === 'BLOB') $ind['photo'] = $sub['value'];
                    }
                    if ($ind['photo'] === '' && $child['value'] !== '') $ind['photo'] = $child['value'];
                    break;
                case 'FAMC': $ind['parentFamilyIds'][] = $child['value']; break;
                case 'FAMS': $ind['spouseFamilyIds'][] = $child['value']; break;
                case 'EVEN': case 'MARR': case 'DIV': case 'CENS': case 'RESI':
                case 'IMMI': case 'EMIG': case 'CHR': case 'BAPM': case 'CONF':
                case 'GRAD': case 'NATU': case 'PROB': case 'WILL': case 'RETI':
                    $event = [
                        'type' => $child['tag'],
                        'date' => '',
                        'place' => '',
                        'description' => $child['value'],
                    ];
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'DATE') $event['date'] = $sub['value'];
                        if ($sub['tag'] === 'PLAC') $event['place'] = $sub['value'];
                        if ($sub['tag'] === 'TYPE') $event['type'] = $sub['value'];
                    }
                    $ind['events'][] = $event;
                    break;
            }
        }

        if ($ind['name'] === '') {
            $ind['name'] = trim(implode(' ', array_filter([
                $ind['prefix'], $ind['givenName'], $ind['surname'], $ind['suffix']
            ])));
        }
        if ($ind['name'] === '') $ind['name'] = 'Unknown';

        $this->individuals[$id] = $ind;
    }

    private function processFamily(array $line): void
    {
        $id = $line['xref'] ?? ('F' . (count($this->families) + 1));
        $fam = [
            'id' => $id,
            'husbandId' => null,
            'wifeId' => null,
            'childrenIds' => [],
            'marriageDate' => '',
            'marriagePlace' => '',
            'divorceDate' => '',
            'notes' => [],
            'sources' => [],
        ];

        foreach ($line['children'] as $child) {
            switch ($child['tag']) {
                case 'HUSB': $fam['husbandId'] = $child['value']; break;
                case 'WIFE': $fam['wifeId'] = $child['value']; break;
                case 'CHIL': $fam['childrenIds'][] = $child['value']; break;
                case 'MARR':
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'DATE') $fam['marriageDate'] = $sub['value'];
                        if ($sub['tag'] === 'PLAC') $fam['marriagePlace'] = $sub['value'];
                    }
                    break;
                case 'DIV':
                    foreach ($child['children'] as $sub) {
                        if ($sub['tag'] === 'DATE') $fam['divorceDate'] = $sub['value'];
                    }
                    break;
                case 'NOTE': $fam['notes'][] = $child['value']; break;
                case 'SOUR': $fam['sources'][] = $child['value']; break;
            }
        }

        $this->families[$id] = $fam;
    }

    private function processSource(array $line): void
    {
        $id = $line['xref'] ?? ('S' . (count($this->sources) + 1));
        $src = ['id' => $id, 'title' => $line['value'], 'author' => '', 'publisher' => '', 'date' => '', 'place' => '', 'notes' => []];
        foreach ($line['children'] as $child) {
            if ($child['tag'] === 'TITL') $src['title'] = $child['value'];
            if ($child['tag'] === 'AUTH') $src['author'] = $child['value'];
            if ($child['tag'] === 'PUBL') $src['publisher'] = $child['value'];
            if ($child['tag'] === 'DATE') $src['date'] = $child['value'];
            if ($child['tag'] === 'PLAC') $src['place'] = $child['value'];
            if ($child['tag'] === 'NOTE') $src['notes'][] = $child['value'];
        }
        $this->sources[$id] = $src;
    }

    private function processRepository(array $line): void
    {
        $id = $line['xref'] ?? ('R' . (count($this->repositories) + 1));
        $repo = ['id' => $id, 'name' => $line['value'], 'address' => '', 'notes' => []];
        foreach ($line['children'] as $child) {
            if ($child['tag'] === 'NAME') $repo['name'] = $child['value'];
            if ($child['tag'] === 'ADDR') $repo['address'] = $child['value'];
            if ($child['tag'] === 'NOTE') $repo['notes'][] = $child['value'];
        }
        $this->repositories[$id] = $repo;
    }

    private function processMedia(array $line): void
    {
        $id = $line['xref'] ?? ('M' . (count($this->media) + 1));
        $med = ['id' => $id, 'file' => '', 'format' => '', 'title' => '', 'notes' => []];
        foreach ($line['children'] as $child) {
            if ($child['tag'] === 'FILE') $med['file'] = $child['value'];
            if ($child['tag'] === 'FORM') $med['format'] = $child['value'];
            if ($child['tag'] === 'TITL') $med['title'] = $child['value'];
            if ($child['tag'] === 'NOTE') $med['notes'][] = $child['value'];
        }
        $this->media[$id] = $med;
    }

    private function processNote(array $line): void
    {
        $id = $line['xref'] ?? ('N' . (count($this->notes) + 1));
        $this->notes[$id] = $line['value'];
    }

    private function processSubmitter(array $line): void
    {
        $id = $line['xref'] ?? ('U' . (count($this->submitters) + 1));
        $sub = ['id' => $id, 'name' => $line['value'], 'address' => ''];
        foreach ($line['children'] as $child) {
            if ($child['tag'] === 'NAME') $sub['name'] = $child['value'];
            if ($child['tag'] === 'ADDR') $sub['address'] = $child['value'];
        }
        $this->submitters[$id] = $sub;
    }

    private function buildRelationships(): void
    {
        foreach ($this->families as $famId => &$family) {
            $husband = $family['husbandId'] ? ($this->individuals[$family['husbandId']] ?? null) : null;
            $wife    = $family['wifeId']    ? ($this->individuals[$family['wifeId']] ?? null) : null;

            if ($husband) {
                $husband['spouses'][] = $wife ? $wife['id'] : null;
                if (!in_array($famId, $husband['spouseFamilyIds'], true)) $husband['spouseFamilyIds'][] = $famId;
            }
            if ($wife) {
                $wife['spouses'][] = $husband ? $husband['id'] : null;
                if (!in_array($famId, $wife['spouseFamilyIds'], true)) $wife['spouseFamilyIds'][] = $famId;
            }

            foreach ($family['childrenIds'] as $childId) {
                if (!isset($this->individuals[$childId])) continue;
                $child = &$this->individuals[$childId];
                if (!in_array($famId, $child['parentFamilyIds'], true)) $child['parentFamilyIds'][] = $famId;
                if ($husband) {
                    if (!in_array($husband['id'], $child['parents'], true)) $child['parents'][] = $husband['id'];
                    if (!in_array($childId, $husband['children'], true)) $husband['children'][] = $childId;
                }
                if ($wife) {
                    if (!in_array($wife['id'], $child['parents'], true)) $child['parents'][] = $wife['id'];
                    if (!in_array($childId, $wife['children'], true)) $wife['children'][] = $childId;
                }
                unset($child);
            }
            unset($family);
        }

        foreach ($this->individuals as &$ind) {
            $siblings = [];
            foreach ($ind['parentFamilyIds'] as $famId) {
                if (isset($this->families[$famId])) {
                    foreach ($this->families[$famId]['childrenIds'] as $childId) {
                        if ($childId !== $ind['id'] && !in_array($childId, $siblings, true)) $siblings[] = $childId;
                    }
                }
            }
            $ind['siblings'] = $siblings;
            $ind['spouses'] = array_values(array_filter($ind['spouses'], fn($s) => $s !== null));
            unset($ind);
        }
    }

    private function result(): array
    {
        return [
            'header' => $this->header,
            'individuals' => array_values($this->individuals),
            'families' => array_values($this->families),
            'sources' => array_values($this->sources),
            'repositories' => array_values($this->repositories),
            'media' => array_values($this->media),
            'notes' => array_values(array_map(fn($v, $k) => ['id' => $k, 'text' => $v], $this->notes, array_keys($this->notes))),
            'submitters' => array_values($this->submitters),
            'errors' => $this->errors,
            'stats' => [
                'individualCount' => count($this->individuals),
                'familyCount' => count($this->families),
                'sourceCount' => count($this->sources),
                'mediaCount' => count($this->media),
            ],
        ];
    }
}
