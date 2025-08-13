(function (global) {
  class FormValidator {
    constructor(option) {
      this.option = option;
      this.rules = {
        isRequired: (value) =>
          value.trim() ? "" : "*Trường này không được để trống.",
        isEmail: (value) =>
          /\S+@\S+\.\S+/.test(value) ? "" : "*Email không hợp lệ.",
        minLength: (value, min) =>
          value.length >= min ? "" : `*Phải có ít nhất ${min} ký tự.`,
        isMatch: (value, compareValue) => {
          const compareInput = document.getElementById(compareValue);
          return value === compareInput?.value ? "" : "*Giá trị không khớp.";
        },
      };
      this.init();
    }

    getParent(element, selector) {
      while (element.parentElement) {
        if (element.parentElement.matches(selector))
          return element.parentElement;
        element = element.parentElement;
      }
    }

    showError(input, message) {
      const formGroup = this.getParent(input, this.option.formGroupSelect);
      const msg =
        formGroup?.querySelector(this.option.message) ||
        formGroup.nextElementSibling;
      if (msg) {
        msg.innerHTML = message;
        input.classList.add("invalid");
      }
    }

    clearError(input) {
      const formGroup = this.getParent(input, this.option.formGroupSelect);
      const msg =
        formGroup?.querySelector(this.option.message) ||
        formGroup.nextElementSibling;
      if (msg) {
        msg.innerHTML = "";
        input.classList.remove("invalid");
      }
    }

    validate(input) {
      const rules = input.dataset.rule ? input.dataset.rule.split(",") : [];
      let error = "";
      for (let rule of rules) {
        const [ruleName, ...params] = rule.split(":");
        if (this.rules[ruleName]) {
          error = this.rules[ruleName](input.value, ...params);
          if (error) break;
        }
      }

      if (error) {
        this.showError(input, error);
        return false;
      } else {
        this.clearError(input);
        return true;
      }
    }

    init() {
      const form = document.querySelector(this.option.form);
      if (!form) return;

      form.onsubmit = (e) => {
        e.preventDefault();
        let isValid = true;

        form.querySelectorAll("input, select").forEach((input) => {
          if (!this.validate(input)) isValid = false;
        });

        if (isValid && typeof this.option.onSubmit === "function") {
          const formData = new FormData(form);
          const data = {};
          formData.forEach((value, key) => (data[key] = value));
          this.option.onSubmit(data);
        }
      };

      form.querySelectorAll("input, select").forEach((input) => {
        input.oninput = () => this.validate(input);
        input.onblur = () => this.validate(input);
      });
    }
  }
  class DataTableLib {
    constructor(options = {}) {
      const defaults = {
        api: null,
        rows: 5,
        currentPage: 1,
        tableId: "tbl-application",
        onRender: null,
        pagination: true,
        searchBoxId: "",
        serverSide: false,
        totalRows: 0,
        loadingId: "",
        errorId: "",
        sortable: true,
        paginationId: "",
        columnsConfig: [], // [{ field, label, render: row => `<b>${row.name}</b>` }]
        searchDebounceMs: 400,
        buildUrl: null, // callback tùy chỉnh build URL
        formatData: null, // callback tùy chỉnh format dữ liệu
      };
      Object.assign(this, defaults, options);

      this.data = [];
      this.filteredData = [];
      this.sortConfig = { key: null, direction: "asc" };
      this.baseApi = this.api;

      // debounce & fetch control
      this._searchTimer = null;
      this._abortController = null;
    }

    getArrayFromData(data) {
      if (Array.isArray(data)) return [...data];
      for (const key in data) {
        if (Array.isArray(data[key])) return [...data[key]];
      }
      return [];
    }

    async init() {
      await this.fetchData();
      this._setupSearch();
      if (this.sortable) this.enableSorting();
    }

    _setupSearch() {
      if (!this.searchBoxId) return;
      const input = document.getElementById(this.searchBoxId);
      if (!input) return;

      input.addEventListener("input", (e) => {
        const keyword = e.target.value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          if (this.serverSide) {
            this.currentPage = 1;
            this.fetchData(1, keyword);
          } else {
            this.search(keyword);
          }
        }, this.searchDebounceMs);
      });
    }

    async fetchData(page = this.currentPage, searchTerm = "") {
      this.showLoading(true);
      // Hủy request cũ nếu còn
      try {
        this._abortController?.abort();
      } catch {}
      this._abortController = new AbortController();

      try {
        // Dùng callback buildUrl nếu serverSide
        let url =
          this.serverSide && typeof this.buildUrl === "function"
            ? this.buildUrl(page, searchTerm)
            : this.api;

        const res = await fetch(url, { signal: this._abortController.signal });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        let result = await res.json();

        if (typeof this.formatData === "function") {
          // Luôn áp dụng formatData nếu có
          const formatted = this.formatData(result) || [];
          this.data = Array.isArray(formatted)
            ? formatted
            : this.getArrayFromData(formatted);
        } else {
          // Không có formatData → tự tìm mảng trong object hoặc dùng thẳng
          this.data = this.getArrayFromData(result);
        }

        // Gán filteredData và totalRows
        this.filteredData = [...this.data];
        this.totalRows = this.serverSide
          ? result.total || this.filteredData.length
          : this.filteredData.length;

        this.render();
      } catch (err) {
        if (err.name !== "AbortError") this.showError(err.message);
      } finally {
        this.showLoading(false);
      }
    }

    flattenValues(obj) {
      return Object.values(obj).flatMap((val) =>
        typeof val === "object" && val !== null
          ? this.flattenValues(val)
          : [val]
      );
    }

    search(keyword = "") {
      const key = keyword.toLowerCase().trim();
      this.filteredData = key
        ? this.data.filter((item) =>
            this.flattenValues(item).some((val) =>
              String(val ?? "")
                .toLowerCase()
                .includes(key)
            )
          )
        : [...this.data];
      this.currentPage = 1;
      this.render();
    }

    enableSorting() {
      const table = document.getElementById(this.tableId);
      const headers = table?.querySelectorAll("thead th");
      headers?.forEach((th) => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
          const key = th.dataset.key;
          this.sortConfig.direction =
            this.sortConfig.key === key && this.sortConfig.direction === "asc"
              ? "desc"
              : "asc";
          this.sortConfig.key = key;
          this.sortData();
        });
      });
    }

    sortData() {
      const { key, direction } = this.sortConfig;
      if (!key) return;
      this.filteredData.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      });
      this.render();
    }

    renderTableRows() {
      const table = document.getElementById(this.tableId);
      const thead = table?.querySelector("thead");
      const tbody = table?.querySelector("tbody");
      if (!tbody || !thead) return;

      // Header
      thead.innerHTML = "";
      const headerRow = document.createElement("tr");
      this.columnsConfig.forEach((col) => {
        const th = document.createElement("th");
        th.textContent = col.label || col.field;
        th.dataset.key = col.field;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      // Body
      tbody.innerHTML = "";
      let displayData = this.filteredData;
      let totalPages = 1;

      if (this.pagination) {
        if (this.serverSide) {
          totalPages = Math.ceil(this.totalRows / this.rows) || 1;
        } else {
          totalPages = Math.ceil(displayData.length / this.rows) || 1;
          const start = (this.currentPage - 1) * this.rows;
          const end = start + this.rows;
          displayData = displayData.slice(start, end);
        }
      }

      const fragment = document.createDocumentFragment();
      displayData.forEach((row) => {
        const tr = document.createElement("tr");
        this.columnsConfig.forEach((col) => {
          const td = document.createElement("td");
          if (typeof col.render === "function") {
            td.innerHTML = col.render(row);
          } else {
            td.textContent = row[col.field] ?? "";
          }
          tr.appendChild(td);
        });
        fragment.appendChild(tr);
      });
      tbody.appendChild(fragment);

      if (this.pagination) this.renderPagination(totalPages);
      if (this.sortable) this.enableSorting();
    }

    renderPagination(totalPages) {
      if (!this.pagination) return;
      if (this.serverSide)
        totalPages = Math.ceil(this.totalRows / this.rows) || 1;

      const containerId = this.paginationId || `pagination-${this.tableId}`;
      let container = document.getElementById(containerId);

      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        const tableElem = document.getElementById(this.tableId);
        tableElem?.closest(".table-responsive")?.appendChild(container);
      }

      container.innerHTML = "";

      const addButton = (label, page, active = false, disabled = false) => {
        const btn = document.createElement("button");
        btn.textContent = label;
        if (active) btn.classList.add("active");
        if (disabled) btn.disabled = true;
        if (!disabled) {
          btn.addEventListener("click", () => {
            this.currentPage = page;
            if (this.serverSide) this.fetchData(page);
            else this.renderTableRows();
          });
        }
        container.appendChild(btn);
      };

      addButton("«", this.currentPage - 1, false, this.currentPage === 1);
      if (this.currentPage > 2) addButton(1, 1);
      if (this.currentPage >= 3)
        container.appendChild(document.createTextNode("..."));
      for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) {
        if (i > 0 && i <= totalPages) addButton(i, i, i === this.currentPage);
      }
      if (this.currentPage < totalPages - 2)
        container.appendChild(document.createTextNode("..."));
      if (this.currentPage < totalPages - 1) addButton(totalPages, totalPages);
      addButton(
        "»",
        this.currentPage + 1,
        false,
        this.currentPage === totalPages
      );
    }

    render() {
      if (typeof this.onRender === "function")
        this.onRender(this.filteredData, this);
      this.renderTableRows();
    }

    reload() {
      this.filteredData = [...this.data];
      this.currentPage = 1;
      this.render();
    }

    showLoading(show) {
      if (!this.loadingId) return;
      const el = document.getElementById(this.loadingId);
      if (el) el.style.display = show ? "block" : "none";
    }

    showError(message) {
      if (!this.errorId) return;
      const el = document.getElementById(this.errorId);
      if (el) {
        el.textContent = message;
        el.style.display = "block";
      }
    }
  }

  class ApiClient {
    constructor(baseUrl = "", options = {}) {
      this.baseUrl = baseUrl.replace(/\/$/, "");
      this.defaultHeaders = options.headers || {};
      this.token = options.token || null; // JWT hoặc bearer token
      this.defaultTimeout = options.timeout || 10000; // 10 giây
    }

    setToken(token) {
      this.token = token;
    }

    buildUrl(endpoint) {
      return `${this.baseUrl}/${endpoint}`.replace(/\/+$/, "");
    }
    showLoading(show) {
      if (!this.loadingId) return;
      const el = document.getElementById(this.loadingId);
      if (el) el.style.display = show ? "block" : "none";
    }

    showError(message) {
      if (!this.errorId) return;
      const el = document.getElementById(this.errorId);
      if (el) el.textContent = message;
    }

    getDefaultHeaders(noCache = false) {
      const headers = {
        "Content-Type": "application/json",
        ...this.defaultHeaders,
      };

      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      if (noCache) {
        headers["Cache-Control"] = "no-cache";
        headers["Pragma"] = "no-cache";
      }

      return headers;
    }

    async fetchWithTimeout(resource, options = {}) {
      const { timeout = this.defaultTimeout } = options;

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(resource, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(id);

        // Kiểm tra status
        if (!response.ok) {
          let errorDetail = `Request failed with status ${response.status}`;
          try {
            const errorBody = await response.json();
            errorDetail = errorBody.message || JSON.stringify(errorBody);
          } catch (err) {
            // ignore nếu không phải JSON
          }
          throw new Error(errorDetail);
        }

        // Trả về JSON
        return await response.json();
      } catch (error) {
        if (error.name === "AbortError") {
          throw new Error("Request timeout exceeded");
        }
        throw error;
      }
    }

    buildQueryParams(params = {}) {
      const query = new URLSearchParams(params).toString();
      return query ? `?${query}` : "";
    }

    async get(endpoint, { params = {}, noCache = false, timeout } = {}) {
      const url = this.buildUrl(endpoint) + this.buildQueryParams(params);

      return this.fetchWithTimeout(url, {
        method: "GET",
        headers: this.getDefaultHeaders(noCache),
        timeout,
      });
    }

    /**
     * Gửi yêu cầu POST tới endpoint cụ thể
     * @param {string} endpoint - Đường dẫn API
     * @param {object} data - Dữ liệu gửi lên server
     * @param {object} [options] - Tuỳ chọn gửi (noCache, timeout,...)
     * @returns {Promise<any>} Kết quả từ server
     */
    async post(endpoint, body = {}, { noCache = false, timeout } = {}) {
      const isFormData = body instanceof FormData;

      return this.fetchWithTimeout(this.buildUrl(endpoint), {
        method: "POST",
        headers: isFormData ? undefined : this.getDefaultHeaders(noCache),
        body: isFormData ? body : JSON.stringify(body),
        timeout,
      });
    }
    async put(endpoint, body = {}, { noCache = false, timeout } = {}) {
      return this.fetchWithTimeout(this.buildUrl(endpoint), {
        method: "PUT",
        headers: this.getDefaultHeaders(noCache),
        body: JSON.stringify(body),
        timeout,
      });
    }

    async delete(endpoint, { noCache = false, timeout } = {}) {
      return this.fetchWithTimeout(this.buildUrl(endpoint), {
        method: "DELETE",
        headers: this.getDefaultHeaders(noCache),
        timeout,
      });
    }
  }

  // Export 2 class ra global
  global.AppLib = {
    FormValidator,
    DataTableLib,
    ApiClient,
  };
})(window);
