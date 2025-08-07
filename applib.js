(function (global) {
  class FormValidator {
    constructor(option) {
      this.option = option;
      this.rules = {
        isRequired: (value) => (value.trim() ? "" : "*Trường này không được để trống."),
        isEmail: (value) => (/\S+@\S+\.\S+/.test(value) ? "" : "*Email không hợp lệ."),
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
        if (element.parentElement.matches(selector)) return element.parentElement;
        element = element.parentElement;
      }
    }

    showError(input, message) {
      const formGroup = this.getParent(input, this.option.formGroupSelect);
      const msg = formGroup?.querySelector(this.option.message)|| formGroup.nextElementSibling;;
      if (msg) {
        msg.innerHTML = message;
        input.classList.add("invalid");
      }
    }

    clearError(input) {
      const formGroup = this.getParent(input, this.option.formGroupSelect);
      const msg = formGroup?.querySelector(this.option.message) || formGroup.nextElementSibling;
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
    };

    Object.assign(this, defaults, options);
    this.data = [];
    this.filteredData = [];
  }

  async init() {
    await this.fetchData();
  }

  async fetchData() {
    try {
      const res = await fetch(this.api);
      this.data = await res.json();
      this.filteredData = [...this.data];
      this.render(); // Render ban đầu
    } catch (err) {
      console.error("Lỗi khi fetch:", err);
    }
  }

  flattenValues(obj) {
    return Object.values(obj).flatMap((val) =>
      typeof val === "object" && val !== null ? this.flattenValues(val) : [val]
    );
  }

  search(keyword = "") {
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

  renderTableRows() {
    const table = document.getElementById(this.tableId);
    const tbody = table?.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.rows);
    const rowsPerPage = this.rows;
    const totalPages = Math.ceil(rows.length / rowsPerPage) || 1;

    rows.forEach((row, index) => {
      row.style.display = "none";
      if (
        index >= (this.currentPage - 1) * rowsPerPage &&
        index < this.currentPage * rowsPerPage
      ) {
        row.style.display = "";
      }
    });

    this.renderPagination(totalPages);
  }

  renderPagination(totalPages) {
    let container = document.getElementById("pagination");
    if (!container) {
      container = document.createElement("div");
      container.id = "pagination";
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
          this.renderTableRows();
        });
      }
      container.appendChild(btn);
    };

    addButton("«", this.currentPage - 1, false, this.currentPage === 1);

    if (this.currentPage > 2) addButton(1, 1);
    if (this.currentPage >= 3)
      container.appendChild(document.createTextNode("..."));

    for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) {
      if (i > 0 && i <= totalPages) {
        addButton(i, i, i === this.currentPage);
      }
    }

    if (this.currentPage < totalPages - 2)
      container.appendChild(document.createTextNode("..."));
    if (this.currentPage < totalPages - 1)
      addButton(totalPages, totalPages);

    addButton("»", this.currentPage + 1, false, this.currentPage === totalPages);
  }

  render() {
    if (typeof this.onRender === "function") {
      this.onRender(this.filteredData, this);
    }

    // Sau khi render dữ liệu vào bảng, mới gọi logic phân trang DOM
    setTimeout(() => {
      this.renderTableRows();
    });
  }

  reload() {
    this.filteredData = [...this.data];
    this.currentPage = 1;
    this.render();
  }
}


  // Export 2 class ra global
  global.AppLib = {
    FormValidator,
    DataTableLib,
  };
})(window);

 // Validate form
//  new AppLib.FormValidator({
//     form: "#register",
//     formGroupSelect: ".form-group",
//     message: ".error-message",
//     onSubmit: function (data) {
//       console.log("Đăng ký thành công", data);
//     },
//   });

//   // Table với tìm kiếm và phân trang
//   const table = new AppLib.DataTableLib({
//     api: "https://jsonplaceholder.typicode.com/users",
//     tableId: "tbl-application", đổi theo id được
//     rows: 5,
//     onRender: function (data, instance) {
//       const tbody = document.querySelector("#tbl-application tbody");
//       tbody.innerHTML = data
//         .map((item) => `<tr><td>${item.id}</td><td>${item.name}</td><td>${item.email}</td></tr>`)
//         .join("");
//     },
//   });
//   table.init();

//   document.getElementById("searchInput").addEventListener("input", function () {
//     table.search(this.value);
//   });