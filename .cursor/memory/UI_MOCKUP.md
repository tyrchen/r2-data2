# SQL Query Interface UI Mockup

Below is a text-based mockup of the enhanced SQL Query Interface with the three-column layout.

```
+------------------+--------------------------------------------------+----------------------------------------------------+
| ┌──────────────┐ | ┌────────────────────────────────────────────┐  | ┌────────────────────────────────────────────────┐ |
| │              │ | │ ⚲ Search schemas                      ⟳    │  | │ Currently connected to: [users_db]              │ |
| │   🔄 Save    │ | └────────────────────────────────────────────┘  | │                                                │ |
| │              │ | ┌────────────────────────────────────────────┐  | │            [EXECUTE QUERY]                     │ |
| ├──────────────┤ | │ 📁 Databases                               │  | └────────────────────────────────────────────────┘ |
| │              │ | │  ├─ 📁 users_db                            │  | ┌────────────────────────────────────────────────┐ |
| │  📜 History  │ | │  │  ├─ 📋 users                            │  | │                                                │ |
| │              │ | │  │  │  ├─ 🔑 id (INT, PK)                  │  | │ SELECT * FROM users                            │ |
| ├──────────────┤ | │  │  │  ├─ 📄 name (VARCHAR)                │  | │ WHERE active = true                            │ |
| │              │ | │  │  │  ├─ 📄 email (VARCHAR)               │  | │ ORDER BY created_at DESC                       │ |
| │  ⚙️ Settings │ | │  │  │  └─ 📅 created_at (TIMESTAMP)        │  | │ LIMIT 100;                                     │ |
| │              │ | │  │  │                                      │  | │                                                │ |
| ├──────────────┤ | │  │  ├─ 📋 orders                           │  | │                                                │ |
| │              │ | │  │  │  ├─ 🔑 id (INT, PK)                  │  | │                                                │ |
| │   ❓ Help    │ | │  │  │  ├─ 🔗 user_id (INT, FK → users.id)  │  | │                                                │ |
| │              │ | │  │  │  ├─ 📄 status (VARCHAR)              │  | │                                                │ |
| ├──────────────┤ | │  │  │  └─ 💲 amount (DECIMAL)              │  | │                                                │ |
| │              │ | │  │  │                                      │  | │                                                │ |
| │              │ | │  │  └─ 📋 items                            │  | │                                                │ |
| │              │ | │  │     ├─ 🔑 id (INT, PK)                  │  | │                                                │ |
| │              │ | │  │     ├─ 🔗 order_id (INT, FK → orders.id)│  | │                                                │ |
| │              │ | │  │     ├─ 📄 name (VARCHAR)                │  | │                                                │ |
| │              │ | │  │     └─ 💲 price (DECIMAL)               │  | │                                                │ |
| │              │ | │  │                                         │  | │                                                │ |
| │              │ | │  └─ 📁 analytics_db                        │  | └────────────────────────────────────────────────┘ |
| │              │ | │     └─ ...                                 │  | ┌────────────────────────────────────────────────┐ |
| │              │ | │                                            │  | │ [Table ⇄ Chart]       Rows: 42  Time: 0.05s    │ |
| │              │ | │                                            │  | ├────────┬─────────────┬─────────────┬───────────┤ |
| │              │ | │                                            │  | │   id   │    name     │    email    │ created_at │ |
| │              │ | │                                            │  | ├────────┼─────────────┼─────────────┼───────────┤ |
| │              │ | │                                            │  | │   1    │ John Doe    │ jd@test.com │ 2023-01-15 │ |
| │              │ | │                                            │  | │   2    │ Jane Smith  │ js@test.com │ 2023-01-16 │ |
| │              │ | │                                            │  | │   3    │ Alice Brown │ ab@test.com │ 2023-01-18 │ |
| └──────────────┘ | │                                            │  | │   ...  │  ...        │  ...        │  ...       │ |
|                  | │                                            │  | └────────┴─────────────┴─────────────┴───────────┘ |
|                  | │                                            │  |                                                    |
|                  | │                                            │  |                                                    |
|                  | │                                            │  |                                                    |
+------------------+--------------------------------------------------+----------------------------------------------------+
     Column 1                        Column 2                                             Column 3
    (Toolbox)                   (Catalog Browser)                                 (SQL Editor & Results)
```

## Field Detail Popup (appears when clicking on a field)

```
+----------------------------------------------+
| ℹ️ Field: email                              |
|                                              |
| Type: VARCHAR(255)                           |
| Nullable: NO                                 |
| Constraints: UNIQUE                          |
|                                              |
| Description: User's primary email address    |
|                                              |
| References: None                             |
| Referenced by: None                          |
|                                              |
|            [Close]                           |
+----------------------------------------------+
```

## Mobile View (Single Column with Navigation)

```
+--------------------------------------------------+
| ┌────────────────────────────────────────────┐   |
| │ ≡ Menu      SQL Query Interface     📋→📊   |   |
| └────────────────────────────────────────────┘   |
|                                                  |
| ┌────────────────────────────────────────────┐   |
| │ < Back to Catalog                          |   |
| │                                            |   |
| │ SELECT * FROM users                        |   |
| │ WHERE active = true                        |   |
| │ ORDER BY created_at DESC                   |   |
| │ LIMIT 100;                                 |   |
| │                                            |   |
| │                                            |   |
| │            [EXECUTE QUERY]                 |   |
| └────────────────────────────────────────────┘   |
|                                                  |
| ┌────────────────────────────────────────────┐   |
| │ Results                              Table ▼   |
| ├────────┬─────────────┬─────────────┬───────┤   |
| │   id   │    name     │    email    │ creat…│   |
| ├────────┼─────────────┼─────────────┼───────┤   |
| │   1    │ John Doe    │ jd@test.com │ 2023-…│   |
| │   2    │ Jane Smith  │ js@test.com │ 2023-…│   |
| │   3    │ Alice Brown │ ab@test.com │ 2023-…│   |
| │   ...  │  ...        │  ...        │  ...  │   |
| └────────┴─────────────┴─────────────┴───────┘   |
|                                                  |
+--------------------------------------------------+
```

## Dark Mode Variant

```
+------------------+--------------------------------------------------+----------------------------------------------------+
| ┌──────────────┐ | ┌────────────────────────────────────────────┐  | ┌────────────────────────────────────────────────┐ |
| │              │ | │ ⚲ Search schemas                      ⟳    │  | │ Currently connected to: [users_db]              │ |
| │   🔄 Save    │ | └────────────────────────────────────────────┘  | │                                                │ |
| │              │ | ┌────────────────────────────────────────────┐  | │            [EXECUTE QUERY]                     │ |
| ├──────────────┤ | │ 📁 Databases                               │  | └────────────────────────────────────────────────┘ |
| │              │ | │  ├─ 📁 users_db                            │  | ┌────────────────────────────────────────────────┐ |
| │  📜 History  │ | │  │  ├─ 📋 users                            │  | │                                                │ |
| │              │ | │  │  │  ├─ 🔑 id (INT, PK)                  │  | │ SELECT * FROM users                            │ |
| ├──────────────┤ | │  │  │  ├─ 📄 name (VARCHAR)                │  | │ WHERE active = true                            │ |
| │              │ | │  │  │  ├─ 📄 email (VARCHAR)               │  | │ ORDER BY created_at DESC                       │ |
| │  ⚙️ Settings │ | │  │  │  └─ 📅 created_at (TIMESTAMP)        │  | │ LIMIT 100;                                     │ |
| │              │ | │  │  │                                      │  | │                                                │ |
| ├──────────────┤ | │  │  ├─ 📋 orders                           │  | │                                                │ |
| │              │ | │  │  │  ├─ 🔑 id (INT, PK)                  │  | │                                                │ |
| │   ❓ Help    │ | │  │  │  ├─ 🔗 user_id (INT, FK → users.id)  │  | │                                                │ |
| │              │ | │  │  │  ├─ 📄 status (VARCHAR)              │  | │                                                │ |
| └──────────────┘ | │  │  │  └─ 💲 amount (DECIMAL)              │  | │                                                │ |
|                  | │  │  │                                      │  | │                                                │ |
|                  | │  │  └─ 📋 items                            │  | │                                                │ |
|                  | │  │     ├─ 🔑 id (INT, PK)                  │  | │                                                │ |
|                  | │  │     ├─ 🔗 order_id (INT, FK → orders.id)│  | │                                                │ |
|                  | │  │     ├─ 📄 name (VARCHAR)                │  | │                                                │ |
|                  | │  │     └─ 💲 price (DECIMAL)               │  | │                                                │ |
|                  | │  │                                         │  | │                                                │ |
|                  | │  └─ 📁 analytics_db                        │  | └────────────────────────────────────────────────┘ |
|                  | │     └─ ...                                 │  | ┌────────────────────────────────────────────────┐ |
|                  | │                                            │  | │ [Table ⇄ Chart]       Rows: 42  Time: 0.05s    │ |
|                  | │                                            │  | ├────────┬─────────────┬─────────────┬───────────┤ |
|                  | │                                            │  | │   id   │    name     │    email    │ created_at │ |
|                  | │                                            │  | ├────────┼─────────────┼─────────────┼───────────┤ |
|                  | │                                            │  | │   1    │ John Doe    │ jd@test.com │ 2023-01-15 │ |
|                  | │                                            │  | │   2    │ Jane Smith  │ js@test.com │ 2023-01-16 │ |
|                  | │                                            │  | │   3    │ Alice Brown │ ab@test.com │ 2023-01-18 │ |
|                  | │                                            │  | │   ...  │  ...        │  ...        │  ...       │ |
|                  | │                                            │  | └────────┴─────────────┴─────────────┴───────────┘ |
+------------------+--------------------------------------------------+----------------------------------------------------+
```

## Key UI Features Highlighted

1. **Hierarchical Schema Navigation** - Intuitive tree structure for database exploration
2. **Field Type Indicators** - Visual icons indicating data types and constraints
3. **Contextual Query Editor** - Editor with schema awareness and syntax highlighting
4. **Switchable Results View** - Toggle between tabular and visualization views
5. **Responsive Layout** - Adapts to different screen sizes with collapsible panels
6. **Query Statistics** - Shows row count and execution time
7. **Utility Toolbox** - Quick access to common functions
