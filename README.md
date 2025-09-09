# applib (phiên bản hiện đại hóa)
applib là một thư viện frontend nhỏ gọn bao gồm 2 thành phần chính:
- DataTableLib — bảng dữ liệu hỗ trợ client/server-side, tìm kiếm, phân trang, sắp xếp, render tuỳ biến cột và hàng (rowRenderer).
- ApiClient — wrapper fetch với timeout, xử lý JSON/text và header mặc định.

Tài liệu này hướng dẫn cách dùng, các tuỳ chọn quan trọng và ví dụ.

---

## Cài đặt / Sử dụng
Sao chép file `applib.mjs` vào dự án của bạn và import các class cần thiết. Nếu dùng bundler (webpack/rollup), import bình thường; nếu sử dụng trực tiếp trên trình duyệt, dùng `<script type="module">`.

Ví dụ:
```html
<script type="module">
import { DataTableLib, ApiClient } from './applib.mjs';
// sử dụng ở đây
</script>
```

---
## ApiClient

Ví dụ dùng:
```js
import { ApiClient } from './applib.mjs';

const api = new ApiClient('https://api.example.com', { token: 'YOUR_TOKEN', timeout: 10000 });
const users = await api.get('users', { params: { page: 1 }});
```

Tính năng:
- Tự động parse JSON hoặc trả về text nếu content-type không phải JSON.
- Timeout với AbortController.
- Thiết lập header mặc định và Authorization Bearer token.
- Hỗ trợ `get`, `post`, `put`, `delete`.

Ghi chú:
- `buildUrl` xử lý slash an toàn để tránh double-slash.
- Khi gửi FormData, ApiClient không set `Content-Type` để trình duyệt tự set boundary.

Gợi ý:
- Nên sử dụng 1 module call api riêng biệt, dễ bảo trì và thao tác hơn
- Ví dụ:
```js
import { ApiClient } from "/libs/js/applib.js";

const api = new ApiClient("http://localhost:3000");

api.registerPostEndpoint("postUserLogin", "api/auth/login");
api.registerPostEndpoint("postUserRegister", "api/auth/register");

export default api.endpoints;
```
- Tại các module khác cần 
```js
import API from "/assets/js/callapi.js";
const{postUserLogin,postUserRegister}=API;
```
- Cách gọi api
```js
 const res= await postUserLogin
    ({
        username: _ui.userLogin.value.trim(), 
        password: _ui.passLogin.value.trim(),
    })
    console.log(res);
```
---
Một số ví dụ sử dụng ApiClient chi tiết
1 GET:
```js
// query params
await api.get('users', { params: { page: 2, limit: 10 } });

// không cache
await api.get('users', { noCache: true });

// custom timeout
await api.get('users', { timeout: 5000 });
```
- params: Object { key: value } → chuyển thành query string

- noCache: true → thêm header Cache-Control: no-cache

- timeout: số ms, default = defaultTimeout
2 POST:
```js
// gửi JSON
await api.post('users', { name: 'Alice', age: 25 });

// gửi FormData
const formData = new FormData();
formData.append('avatar', fileInput.files[0]);
await api.post('users/upload', formData);
```
- Nếu body là FormData, Content-Type sẽ tự động bỏ qua.

- Nếu là JSON, tự động stringify
3 PUT:
```js
await api.put('users/123', { name: 'Bob', age: 30 });

```
- Cập nhật dữ liệu, body dạng JSON.

- Hỗ trợ noCache và timeout tương tự GET/POST.
4 DELETE:
```js
await api.delete('users/123');
//dùng với params
await api.delete('users', { params: { id: 123 } });
```
---
Cách xử lý lỗi
```js
try {
  const data = await api.get('users/999');
  console.log(data);
} catch (error) {
  console.error('API Error:', error.message);
}
```
---
Chức năng khác
1 Build URL & Query params:
```js
const api = new ApiClient("https://dev.example.com");
const url = api.buildUrl('users'); // https://api.example.com/users
const query = api.buildQueryParams({ page: 1, limit: 10 }); // ?page=1&limit=10

```
- Build_URL tự loại dấu thừa /, tránh viết URL thủ công nhiều nơi
- Query params chuyển object { key: value } → query string, không cần tự encode, tránh lỗi khi params phức tạp,Tự động bỏ nếu object rỗng

Tóm lại để tránh viết dài mà nhiều với Build_URL và  biến object { key: value } thành query string cho GET/DELETE với query params:))) 
```js
const query = api.buildQueryParams({ page: 1, limit: 10 });
console.log(query); // "?page=1&limit=10"   <- nó tạp ra cái này


const api = new ApiClient("https://api.example.com");
const url = api.buildUrl("users");
console.log(url); // "https://api.example.com/users"  <- viết url là nó ra thế này

```

2 Đăng ký endpoint tiện lợi:
```js
registerGetEndpoint(name, url, cacheOpt)
registerPostEndpoint(name, url)
registerPutEndpoint(name, url)
registerDeleteEndpoint(name, url)

```
- Cách sử dụng endpoints
```js
import { ApiClient } from './ApiClient.js';
const api = new ApiClient('https://jsonplaceholder.typicode.com'); //hoặc /sample-system

// GET
api.registerGetEndpoint('getUsers', 'users');

// POST
api.registerPostEndpoint('createUser', 'users');

// PUT
api.registerPutEndpoint('updateUser', 'users/1');

// DELETE
api.registerDeleteEndpoint('deleteUser', 'users/1');


export default api.endpoints;
```
- Gọi endpoints đã đăng kí
```js
import API from "/assets/js/callapi.js";
  const {getUsers, createUser,updateUser,deleteUser}=API
// GET

const res = await getUsers({ page: 1, limit: 5 });

// POST
const res =await createUser({ name: 'Alice', age: 25 });

// PUT
const res =await updateUser({ name: 'Bob' });

// DELETE
const res =await deleteUser();
```

---

## DataTableLib

Tính năng chính:
- Hỗ trợ client-side hoặc server-side.
- Tìm kiếm kèm debounce.
- Phân trang (pagination).
- Sắp xếp (sortable). Dùng delegation, tránh đăng nhiều listener.
- Render tuỳ chỉnh theo cột (`columnsConfig`) và render toàn hàng (`rowRenderer`).
- Hooks: `onBeforeFetch`, `onAfterFetch`, `onError`.
- Tuỳ chọn `safeHtml` cho cột nếu muốn chấp nhận innerHTML cho cột đó.

Khởi tạo ví dụ:
```js
import { DataTableLib } from './applib.mjs';

const dt = new DataTableLib({
  api: '/api/users',          // endpoint (dùng khi serverSide=true hoặc để fetch ban đầu)
  tableId: 'tbl-users',      // id của <table> (phải có <thead> và <tbody>)
  rows: 10,
  searchBoxId: 'search',
  loadingId: 'loading',
  errorId: 'error',
  columnsConfig: [
    { field: 'id', label: 'ID' },
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'actions', label: 'Actions', render: row => `<a href="/u/${row.id}">Open</a>`, safeHtml: true }
  ],
  // hooks
  // thực hiện các tác vụ như hiện loaading snipper, log lỗi, log data
  onBeforeFetch: () => console.log('fetching...'),
  onAfterFetch: data => console.log('fetched', data),
  onError: err => console.error(err),
  // nếu serverSide=true, cung cấp buildUrl(page, searchTerm)
});

dt.init();
```

---

### rowRenderer — render tùy biến cả hàng (merge cột, layout phức tạp)
Khi bạn cần merge cột hoặc render hàng phức tạp, dùng `rowRenderer`. Nếu `rowRenderer` được cung cấp, thư viện ưu tiên dùng kết quả này cho mỗi `<tr>`.

Hàm signature:
```js
rowRenderer(row, rowIndex, instance) => string | Node | DocumentFragment | Array | null
```

Quy ước kết quả:
- string: gán trực tiếp vào `tr.innerHTML`. Trách nhiệm sanitize thuộc về người dùng (XSS).
- Node hoặc DocumentFragment: append một cách an toàn vào `<tr>`.
- Array: mỗi phần tử là Node hoặc giá trị chuỗi — sẽ tạo `<td>` cho chuỗi.
- falsy (null/undefined/false) hoặc khi `rowRenderer` ném lỗi -> fallback về render mặc định theo `columnsConfig`.

Ví dụ trả HTML (merge cột bằng colspan):
```js
rowRenderer: (row) => `
  <td colspan="2">${row.name} (${row.email})</td>
  <td>${row.status}</td>
  <td><button data-id="${row.id}">Open</button></td>
`
```

Ví dụ trả DocumentFragment (an toàn hơn):
```js
rowRenderer: (row) => {
  const frag = document.createDocumentFragment();
  const td1 = document.createElement('td');
  td1.colSpan = 2;
  td1.textContent = row.name;
  frag.appendChild(td1);
  const td2 = document.createElement('td');
  td2.textContent = row.status;
  frag.appendChild(td2);
  const td3 = document.createElement('td');
  const btn = document.createElement('button');
  btn.textContent = 'Open';
  btn.dataset.id = row.id;
  td3.appendChild(btn);
  frag.appendChild(td3);
  return frag;
}
```

---
Ví dụ về format nếu data không trả về đúng định dạng lib hỗ trợ
```
formatData: (result) => {
     result.total = result?.size ?? [];
     console.log(result);
      return result.data || [];
  },

//Ex 2:
 formatData: (result) => {
    const flatData = [];
    result.data.forEach((item) => {
    item.models?.forEach((model) => {
     model.errors?.forEach((error) => {
      flatData.push({
         highlightDate: item.highlightDate,
         modelName: model.modelName,
         errorCode: error.errorCode,
         errorCount: error.errorCount,
      });
   });
  });
 });
   return flatData.length?flatData:[{ __noData: true }];
},
```
---

## Tuỳ chọn chính của DataTableLib
- api: string — url endpoint (dùng cho fetch ban đầu hoặc server-side).
- rows: number — số dòng mỗi trang.
- tableId: string — id của table.
- columnsConfig: array — danh sách cột: { field, label, render?, safeHtml? }.
- rowRenderer: function — render toàn hàng (ưu tiên).
- serverSide: boolean — bật pagination server-side.
- buildUrl: function(page, searchTerm) — trả URL khi serverSide=true.
- formatData: function(response) — map response thành mảng hoặc object chứa mảng.
- onBeforeFetch/onAfterFetch/onError: hooks.

---

## Bảo mật (XSS)
- Mặc định dùng `textContent` để tránh XSS.
- Nếu sử dụng `safeHtml` cho cột hoặc trả HTML string từ `rowRenderer`, bạn chịu trách nhiệm sanitize dữ liệu (ví dụ: dùng DOMPurify) nếu dữ liệu đến từ nguồn không tin cậy.

---

## Khả năng tiếp cận (Accessibility)
- Thẻ header có `role="button"` khi bật sortable. Nếu cần, mở rộng bằng `aria-sort` và hỗ trợ keyboard để đạt tiêu chuẩn a11y đầy đủ.

---

## Gợi ý nâng cấp tương lai
- Thêm unit tests cho sort/search/validator (Jest).
- Thêm TypeScript types nếu muốn DX tốt hơn.
- Thêm build (UMD/ESM) để phục vụ CDN.
- Thêm tuỳ chọn sanitize và demo ví dụ.

---

## Contribute
- Mở issue hoặc PR nếu muốn mở rộng tính năng.
- Nếu thay đổi DataTableLib, hãy kèm test cho các edge-case sorting/pagination.

```
