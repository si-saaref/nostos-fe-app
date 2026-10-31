# Income and expense create arrays

The frontend create contract for `POST /api/v1/income` and
`POST /api/v1/expenses` uses a non-empty JSON array of objects. A single entry
uses `[entry]`; several entries use `[entry1, entry2, ...]`. There is no
`items` wrapper.

The frontend adapters and MSW handlers implement this contract. The real
backend must adopt it before this frontend change is used against the live API.
The sibling `be-app` repository has not been changed by this frontend update.

Both endpoints are expected to return HTTP `201` with the existing success
envelope and an array in `data`, in request order:

```json
{
  "success": true,
  "data": [
    { "id": "created-id-1", "name": "First entry" },
    { "id": "created-id-2", "name": "Second entry" }
  ]
}
```

The response above is abbreviated: each item must contain the complete
created resource, including its amounts, references and audit fields.

The existing forms still create one entry per submit. Their hooks wrap the
request in an array and map `data[0]` back to one domain entry, preserving the
forms' success callbacks and optimistic updates. PATCH continues to accept
an object and return one resource.

## Postman request examples

Use Body → raw → JSON, `Content-Type: application/json`, the existing session
cookie and the `X-Household-ID` header. Replace the variable values with valid
IDs from the active household. Money remains a decimal string.

`POST {{baseUrl}}/api/v1/income`:

```json
[
  {
    "kind": "EXTERNAL_INCOME",
    "name": "Gaji Oktober",
    "description": null,
    "amount": "5000000.00",
    "type_id": "{{incomeTypeId}}",
    "from_source_id": null,
    "to_source_id": "{{sourceId}}",
    "date": "2026-10-01"
  },
  {
    "kind": "EXTERNAL_INCOME",
    "name": "Bonus Oktober",
    "description": null,
    "amount": "750000.00",
    "type_id": "{{incomeTypeId}}",
    "from_source_id": null,
    "to_source_id": "{{sourceId}}",
    "date": "2026-10-02"
  }
]
```

`POST {{baseUrl}}/api/v1/expenses`:

```json
[
  {
    "name": "Belanja mingguan",
    "description": null,
    "value": "250000.00",
    "type_id": "{{expenseTypeId}}",
    "source_id": "{{sourceId}}",
    "date_paid": "2026-10-01",
    "paid_by_user_id": "{{userId}}"
  },
  {
    "name": "Belanja tambahan",
    "description": null,
    "value": "50000.00",
    "type_id": "{{expenseTypeId}}",
    "source_id": "{{sourceId}}",
    "date_paid": "2026-10-02",
    "paid_by_user_id": "{{userId}}"
  }
]
```

## Batch behavior and file uploads

The mock rejects a direct object, an empty array, null, or any item that is
not an object with `400 VALIDATION_ERROR`. It applies the existing per-entry
validation to every item before updating its store. A failed item leaves the
whole batch unsaved; the real backend should provide the same atomic behavior.

This JSON create contract is separate from the planned Excel upload flow.
Excel upload will send the actual binary file to the backend for parsing;
this change adds no file upload endpoint or client-side Excel conversion.
