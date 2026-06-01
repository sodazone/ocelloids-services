```bash
duckdb -ui
```

```sql
DELETE FROM transfers
WHERE created_at < NOW() - INTERVAL '3 months';
```