"""Golden vectors for packages/audit-commitments, from an independent implementation.

The TypeScript module is tested against these, so its output is checked by
something other than itself. Python's json.dumps with sorted keys and compact
separators produces the same canonical form for every case below (ASCII keys,
integers only, JSON-standard escapes).

    python3 packages/audit-commitments/vectors/generate.py > packages/audit-commitments/vectors/golden.json
"""
import hashlib
import json


def canonical(payload):
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def commit(domain, payload):
    return hashlib.sha256(domain.encode() + b"\x00" + canonical(payload).encode("utf-8")).hexdigest()


CASES = [
    (
        "community record",
        "EMPOWERFI:COMMUNITY:v1",
        {
            "community_id": "3f1c2a9e-8b4d-4e7a-9c1f-2d5b6a7e8f90",
            "community_ref": "a1" * 32,
            "created_at": "2026-09-14T15:00:00.000Z",
            "kind": "programme",
            "name": "Mulheres Empreendedoras do Grajaú",
        },
    ),
    ("key ordering", "EMPOWERFI:COMMUNITY:v1", {"b": 1, "a": 2, "B": 3, "_": 4, "aa": 5, "a_b": 6}),
    (
        "nesting, arrays, null, booleans, negatives",
        "EMPOWERFI:CHECKIN:v1",
        {"z": [3, 1, 2], "nested": {"y": None, "x": True, "w": False}, "n": -42, "zero": 0},
    ),
    (
        "string escapes and unicode",
        "EMPOWERFI:ENROLLMENT:v1",
        {
            "quote": 'she said "yes"',
            "newline": "line1\nline2",
            "tab": "a\tb",
            "backslash": "c:\\path",
            "emoji": "\U0001F331",
            "accent": "coração",
        },
    ),
    ("empty object", "EMPOWERFI:CHECKIN:v1", {}),
    ("largest safe integer", "EMPOWERFI:PAYMENT:v1", {"amount_cents": 9007199254740991}),
]

vectors = {
    "commitments": [
        {
            "name": name,
            "domain": domain,
            "payload": payload,
            "canonical": canonical(payload),
            "commitment": commit(domain, payload),
        }
        for name, domain, payload in CASES
    ],
    "borrower_ref_hashes": [
        {
            "name": name,
            "borrower_ref": ref.hex(),
            "hash": hashlib.sha256(b"EMPOWERFI:BORROWER_REF:v1" + b"\x00" + ref).hexdigest(),
        }
        for name, ref in [
            ("bytes 0..31", bytes(range(32))),
            ("all 0xff", b"\xff" * 32),
        ]
    ],
}

print(json.dumps(vectors, indent=2, ensure_ascii=False))
