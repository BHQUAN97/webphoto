Base Pattern
# Dùng cho BE

# │ Pattern │ Rule cốt lõi │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 1 │ Layer Responsibilities │ Controller=thin adapter, Service=orchestrate, Repo=data only, Domain=pure data │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 2 │ Interface-first │ Mọi service/repo đều có I interface trước khi implement │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 3 │ Generic Base Class │ Base CRUD + Template Method hooks (Before/Validate/After) │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 4 │ DI via Factory │ Không scatter AddScoped — tập trung vào Factory class per module │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 5 │ Try-Catch Rules │ Áp dụng tất cả controller và worker │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 6 │ Logging Rules │ 5 mức đúng chỗ; structured logging; log context đủ để debug; KHÔNG log sensitive │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 7 │ Transaction │ Open→begin→commit/rollback→finally close; pass cnn/tx xuống repo │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 8 │ Controller Pattern │ 1 controller = 1 service call; permission filter; không business logic │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 9 │ Service Pattern │ Template Method: BeforeSave→Validate→SaveData→AfterSave │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 10 │ DTO Pattern │ 1 DTO = 1 operation; IRecordState cho batch save │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 11 │ Validation │ Guard-clause đầu method; collect all errors, throw 1 lần │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 12 │ Async Pattern │ Async toàn chain; Task.WhenAll khi độc lập; SafeStartNew cho fire-and-forget │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 13 │ Background Worker │ KHÔNG re-throw; CreateScope cho scoped service; DLQ cho failed messages │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 14 │ Multi-tenant Context │ ID nhạy cảm từ server context, KHÔNG tin client; propagate SetContext │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 15 │ Performance │ Không N+1; batch query; cache data ít thay đổi; split bulk write │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 16 │ Security │ Parameterized query; không trust client ID; permission trên mọi mutating endpoint │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 17 │ Testing │ Inherits wrapper cho protected; Arrange/Mock/Act/Assert; test naming convention │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 18 │ Naming │ PascalCase class, I interface, _camelCase field, snake_case DB, Async suffix │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 19 │ Clean Code │ No magic string, no copy-paste, no empty catch, method làm 1 việc │
├─────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ 20 │ Project Checklist │ Global filter, structured log, health check, env var config, soft delete, CI pipeline



# Dùng cho FE

# │ Pattern │ Vấn đề giải quyết │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 1 │ Token refresh queue │ Race condition khi nhiều request cùng refresh │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 2 │ Counter-based loading mask │ Nested async tắt mask sớm │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 3 │ Deny-list permissions │ Scalable hơn allow-list khi hầu hết user có quyền │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 4 │ Version bump cache invalidation │ Combobox tự reload sau CRUD, không cần event bus │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 5 │ IndexedDB + server version │ Chỉ fetch lại khi data thực sự stale │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 6 │ Lazy URL resolution │ 1 build, deploy nhiều môi trường │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 7 │ Singleton API instance │ Tránh tạo lại, chia sẻ state │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 8 │ localStorage storage event │ Cross-tab sync không cần WebSocket │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 9 │ Popup registry by name │ Decoupling + lazy load │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 10 │ Recursive date timezone strip │ Server interpret đúng datetime │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 11 │ $ms global plugin │ Tránh import utility trong mọi component │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 12 │ Shortkey stack (ownership) │ Nested popup không conflict keyboard │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 13 │ Master-detail cùng module │ Tránh sync giữa 2 store modules │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 14 │ Partial delete — filter errors │ UX tốt hơn: xóa được thì xóa, còn lại báo lý do │
├─────┼─────────────────────────────────┼───────────────────────────────────────────────────┤
│ 15 │ Mixin super() chain │ Gọi "parent method" khi không có class extends
