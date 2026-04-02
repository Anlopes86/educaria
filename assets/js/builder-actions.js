function renumberCards(selector, labelPrefix) {
    const cards = document.querySelectorAll(selector);
    cards.forEach((card, index) => {
        const label = card.querySelector("[data-card-label]");
        if (label) {
            label.textContent = `${labelPrefix} ${index + 1}`;
        }
    });
}

function cloneQuestionCard(card) {
    const clone = card.cloneNode(true);
    const fields = clone.querySelectorAll("input, textarea, select");
    fields.forEach((field) => {
        if (field.tagName === "SELECT") {
            field.selectedIndex = 0;
        } else {
            field.value = "";
        }
    });
    return clone;
}

function cloneFlashcard(card) {
    const clone = card.cloneNode(true);
    const fields = clone.querySelectorAll("input, textarea");
    fields.forEach((field) => {
        if (field.type === "color") return;
        field.value = "";
    });
    return clone;
}

function cloneSlideCard(card) {
    const clone = card.cloneNode(true);
    const fields = clone.querySelectorAll("input, textarea, select");
    fields.forEach((field) => {
        if (field.tagName === "SELECT") {
            field.selectedIndex = 0;
        } else {
            field.value = "";
        }
    });
    return clone;
}

function bindBuilderActions() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const action = button.dataset.action;

        if (action === "add-question") {
            event.preventDefault();
            const stack = document.querySelector("[data-quiz-stack]");
            const lastCard = stack ? stack.querySelector("[data-quiz-question]:last-child") : null;
            if (!stack || !lastCard) return;
            stack.appendChild(cloneQuestionCard(lastCard));
            renumberCards("[data-quiz-question]", "Questão");
        }

        if (action === "duplicate-question") {
            event.preventDefault();
            const card = button.closest("[data-quiz-question]");
            if (!card) return;
            card.insertAdjacentElement("afterend", cloneQuestionCard(card));
            renumberCards("[data-quiz-question]", "Questão");
        }

        if (action === "remove-question") {
            event.preventDefault();
            const cards = document.querySelectorAll("[data-quiz-question]");
            if (cards.length <= 1) return;
            const card = button.closest("[data-quiz-question]");
            if (!card) return;
            card.remove();
            renumberCards("[data-quiz-question]", "Questão");
        }

        if (action === "add-flashcard") {
            event.preventDefault();
            const stack = document.querySelector("[data-flashcards-stack]");
            const lastCard = stack ? stack.querySelector("[data-flashcard]:last-child") : null;
            if (!stack || !lastCard) return;
            stack.appendChild(cloneFlashcard(lastCard));
            renumberCards("[data-flashcard]", "Card");
        }

        if (action === "duplicate-flashcard") {
            event.preventDefault();
            const card = button.closest("[data-flashcard]");
            if (!card) return;
            card.insertAdjacentElement("afterend", cloneFlashcard(card));
            renumberCards("[data-flashcard]", "Card");
        }

        if (action === "remove-flashcard") {
            event.preventDefault();
            const cards = document.querySelectorAll("[data-flashcard]");
            if (cards.length <= 1) return;
            const card = button.closest("[data-flashcard]");
            if (!card) return;
            card.remove();
            renumberCards("[data-flashcard]", "Card");
        }

        if (action === "add-slide") {
            event.preventDefault();
            const stack = document.querySelector("[data-slides-stack]");
            const lastCard = stack ? stack.querySelector("[data-slide-card]:last-child") : null;
            if (!stack || !lastCard) return;
            stack.appendChild(cloneSlideCard(lastCard));
            renumberCards("[data-slide-card]", "Slide");
        }

        if (action === "duplicate-slide") {
            event.preventDefault();
            const card = button.closest("[data-slide-card]");
            if (!card) return;
            card.insertAdjacentElement("afterend", cloneSlideCard(card));
            renumberCards("[data-slide-card]", "Slide");
        }

        if (action === "remove-slide") {
            event.preventDefault();
            const cards = document.querySelectorAll("[data-slide-card]");
            if (cards.length <= 1) return;
            const card = button.closest("[data-slide-card]");
            if (!card) return;
            card.remove();
            renumberCards("[data-slide-card]", "Slide");
        }

        document.dispatchEvent(new Event("input"));
    });
}

document.addEventListener("DOMContentLoaded", bindBuilderActions);
