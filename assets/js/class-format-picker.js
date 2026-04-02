document.addEventListener("DOMContentLoaded", () => {
    const select = document.querySelector("[data-format-select]");
    const button = document.querySelector("[data-format-go]");
    if (!select || !button) return;

    button.addEventListener("click", () => {
        if (!select.value) return;
        window.location.href = select.value;
    });
});
