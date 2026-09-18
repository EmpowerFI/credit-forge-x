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
    (
        # The settlement route decision: both quotes as the comparator saw
        # them, its reasons and its version. Nested objects inside an array,
        # which no earlier case covers, and no personal data in any of it.
        "settlement route decision",
        "EMPOWERFI:SETTLEMENT_ROUTE:v1",
        {
            "compared_gross_micro_usdc": 704000000,
            "decided_at": "2026-09-18T13:34:13.828Z",
            "loan_id": "01a0fec7-200f-45c2-a92c-2dac849cd7be",
            "model_version": "settlement-route-v1.0.0",
            "net_brl_delta_cents": 2254,
            "opportunity_no": 7,
            "principal_cents": 380000,
            "quotes": [
                {
                    "blocks": [],
                    "cost_bps": 179,
                    "execution_eta_sec": 900,
                    "expires_at": "2026-09-18T13:44:13.828Z",
                    "feasible": True,
                    "fx_cost_cents": 4562,
                    "fx_rate_milli": 5400,
                    "fx_spread_bps": 120,
                    "fx_struck": "payout",
                    "gross_brl_cents": 380160,
                    "hops": 1,
                    "liquidity_ok": True,
                    "net_brl_cents": 373344,
                    "network_fee_cents": 0,
                    "provider": "regulated_offramp",
                    "provider_fee_cents": 2254,
                    "quoted_at": "2026-09-18T13:34:13.828Z",
                    "reality": "simulated",
                    "route": "direct_usdc_pix",
                    "total_cost_cents": 6816,
                },
                {
                    "blocks": ["ROUTE_PROVIDER_UNAVAILABLE"],
                    "cost_bps": 239,
                    "execution_eta_sec": 300,
                    "expires_at": "2026-09-14T01:00:00.000Z",
                    "feasible": False,
                    "fx_cost_cents": 4562,
                    "fx_rate_milli": 5400,
                    "fx_spread_bps": 120,
                    "fx_struck": "allocation",
                    "gross_brl_cents": 380160,
                    "hops": 2,
                    "liquidity_ok": True,
                    "net_brl_cents": 371090,
                    "network_fee_cents": 0,
                    "provider": "brl_stablecoin",
                    "provider_fee_cents": 4508,
                    "quoted_at": "2026-09-13T01:00:00.000Z",
                    "reality": "simulated",
                    "route": "brl_stable_pix",
                    "total_cost_cents": 9070,
                },
            ],
            "reason_codes": ["DIRECT_LOWEST_COST", "EXTRA_CONVERSION_ADDS_COST"],
            "selected_route": "direct_usdc_pix",
        },
    ),
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
    "allocation_ref_hashes": [
        {
            "name": name,
            "allocation_ref": ref.hex(),
            "hash": hashlib.sha256(b"EMPOWERFI:ALLOCATION_REF:v1" + b"\x00" + ref).hexdigest(),
        }
        for name, ref in [
            ("bytes 0..31", bytes(range(32))),
            ("all 0xff", b"\xff" * 32),
        ]
    ],
}

print(json.dumps(vectors, indent=2, ensure_ascii=False))
