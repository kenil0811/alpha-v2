# Journey a-member-joins: 2026-11-22 14:57

A member added to a workspace already set up goes through their own shorter story, never seeing Claude or Your people, and is told only what is true about what is shared

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Failed** in 0 s, $0.00.


## 1. **The owner could not go through welcome (404: {"message":"Route POST:/api/story/welcome not found","error":"Not Found","statusCode":404}).**

Took 0.1 s.


## 2. **The owner could not go through workspace (404: {"message":"Route POST:/api/story/workspace not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.


## 3. **The owner has no story to go through (404).**

Took 0.0 s.


## 4. **The owner could not go through done (404: {"message":"Route POST:/api/story/done not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: the owner's story: done (saw 404: {"message":"Route GET:/api/story not found","error":"Not Found","statusCode":404})

## 5. The owner added Priya (priya@harborbooks.example)

Took 0.0 s.

- **FAIL**: Priya's story: chapters welcome, here, connect, done; at welcome; not done (saw 404: {"message":"Route GET:/api/story not found","error":"Not Found","statusCode":404})

## 6. **Priya could not go through welcome (404: {"message":"Route POST:/api/story/welcome not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: Priya's here says /Harbor Books/ (saw 404: {"message":"Route GET:/api/story/here not found","error":"Not Found","statusCode":404})
- **FAIL**: Priya's here says /everyone/, never /private/ (saw 404: {"message":"Route GET:/api/story/here not found","error":"Not Found","statusCode":404})

## 7. **Priya could not go through here (404: {"message":"Route POST:/api/story/here not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.


## 8. **Priya could not go through connect (404: {"message":"Route POST:/api/story/connect not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.


## 9. **Priya could not go through done (404: {"message":"Route POST:/api/story/done not found","error":"Not Found","statusCode":404}).**

Took 0.0 s.

- **FAIL**: Priya's story: done; no Home row (saw 404: {"message":"Route GET:/api/story not found","error":"Not Found","statusCode":404})
- **FAIL**: the owner's story: done (saw 404: {"message":"Route GET:/api/story not found","error":"Not Found","statusCode":404})
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 2 lines.

## The world after
