(function(global) {
  "use strict";

  /* ======= DataTableLib cải tiến ======= */
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
        sortable: true
      };
      Object.assign(this, defaults, options);

      this.data = [];
      this.filteredData = [];
      this.sortConfig = { key: null, direction: 'asc' };
      this.baseApi = this.api;
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
      if (this.searchBoxId) {
        const searchInput = document.getElementById(this.searchBoxId);
        if (searchInput) {
          searchInput.addEventListener("input", (e) => this.search(e.target.value));
        }
      }
      if (this.sortable) {
        this.enableSorting();
      }
    }

    async fetchData(page = this.currentPage, searchTerm = "") {
      this.showLoading(true);
      try {
        let url = this.serverSide ? this.buildServerSideUrl(page, searchTerm) : this.api;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const result = await res.json();

        if (this.serverSide) {
          this.filteredData = this.getArrayFromData(result.data);
          this.totalRows = result.total || 0;
        } else {
          this.data = result;
          this.filteredData = this.getArrayFromData(this.data);
        }

        this.render();
      } catch (err) {
        this.showError(err.message);
      } finally {
        this.showLoading(false);
      }
    }

    buildServerSideUrl(page, searchTerm) {
      const separator = this.baseApi.includes("?") ? "&" : "?";
      let url = `${this.baseApi}${separator}page=${page}&limit=${this.rows}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      return url;
    }

    flattenValues(obj) {
      return Object.values(obj).flatMap((val) =>
        typeof val === "object" && val !== null
          ? this.flattenValues(val)
          : [val]
      );
    }

    search(keyword = "") {
      if (this.serverSide) {
        this.fetchData(1, keyword);
        return;
      }
      const key = keyword.toLowerCase().trim();
      this.filteredData = key
        ? this.data.filter((item) =>
            this.flattenValues(item).some((val) =>
              String(val ?? "").toLowerCase().includes(key)
            )
          )
        : [...this.data];
      this.currentPage = 1;
      this.render();
    }

    enableSorting() {
      const table = document.getElementById(this.tableId);
      const headers = table?.querySelectorAll("thead th");
      headers?.forEach((th, index) => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
          const key = th.dataset.key || index;
          this.sortConfig.direction =
            this.sortConfig.key === key && this.sortConfig.direction === 'asc'
              ? 'desc'
              : 'asc';
          this.sortConfig.key = key;
          this.sortData();
        });
      });
    }

    sortData() {
      const { key, direction } = this.sortConfig;
      this.filteredData.sort((a, b) => {
        const valA = Object.values(a)[key];
        const valB = Object.values(b)[key];
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
      this.render();
    }

    renderTableRows() {
      const table = document.getElementById(this.tableId);
      const tbody = table?.querySelector("tbody");
      if (!tbody) return;

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
        Object.values(row).forEach((cell) => {
          const td = document.createElement("td");
          td.textContent = cell;
          tr.appendChild(td);
        });
        fragment.appendChild(tr);
      });
      tbody.appendChild(fragment);

      if (this.pagination) {
        this.renderPagination(totalPages);
      }
    }

    renderPagination(totalPages) {
      if (!this.pagination) return;
      const containerId = `pagination-${this.tableId}`;
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
            if (this.serverSide) {
              this.fetchData(page);
            } else {
              this.renderTableRows();
            }
          });
        }
        container.appendChild(btn);
      };

      addButton("«", this.currentPage - 1, false, this.currentPage === 1);

      if (this.currentPage > 2) addButton(1, 1);
      if (this.currentPage >= 3) container.appendChild(document.createTextNode("..."));

      for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) {
        if (i > 0 && i <= totalPages) {
          addButton(i, i, i === this.currentPage);
        }
      }

      if (this.currentPage < totalPages - 2)
        container.appendChild(document.createTextNode("..."));
      if (this.currentPage < totalPages - 1) addButton(totalPages, totalPages);

      addButton("»", this.currentPage + 1, false, this.currentPage === totalPages);
    }

    render() {
      if (typeof this.onRender === "function") {
        this.onRender(this.filteredData, this);
      }
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
      if (el) el.textContent = message;
    }
  }

  /* ======= Xuất ra global ======= */
  global.AppLib = {
    DataTableLib
    // FormValidator,
    // ApiClient
  };

})(window);
