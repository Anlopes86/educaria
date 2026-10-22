import { diagramExamples } from "./slide-diagrams.mjs";

// Deterministic, synthetic content for visual QA. Never calls a provider.
export const slideVisualFixture = {
    title: "Explorar, comparar e explicar",
    visual_theme: {
        name: "Terra e descobertas", rationale: "Tons terrosos e acentos azuis para contrastar ideias.",
        font: "Serifada clássica", accent: "#c05621", secondary_accent: "#1d4ed8",
        background: "#fffaf5", alternate_background: "#f6f9ff", text: "#30231d",
        contrast_background: "#30231d", contrast_text: "#fffaf5"
    },
    slides: [
        { type: "cover", composition: "focus", title: "Um olhar curioso muda tudo", subtitle: "Observar • comparar • explicar", body: "Como podemos transformar uma observação em uma boa pergunta?" },
        { type: "content", composition: "panels", title: "Dois caminhos para aprender", body: "Observar: descreva o que você consegue perceber, sem tentar explicar imediatamente.\nInvestigar: faça uma pergunta, compare possibilidades e procure evidências para respondê-la." },
        { type: "content", composition: "editorial", title: "Uma ideia pode ser representada", body: "Um diagrama organiza elementos e suas relações. Observe a sequência ao lado e explique o que muda entre uma etapa e outra.", illustration: diagramExamples[0] },
        { type: "content", composition: "focus", title: "Explicar exige conectar as ideias", body: "Uma explicação vai além de listar fatos: ela relaciona observações, possíveis causas e consequências. Ao comparar duas situações, identifique primeiro o que mudou e o que permaneceu igual.\nPor exemplo, ao acompanhar uma planta, registre a quantidade de água, a luz disponível e o tempo de observação. Essas anotações ajudam a distinguir uma impressão inicial de uma mudança consistente.\nNem sempre uma única observação permite concluir o que causou o resultado. Procure outras evidências e reconheça as dúvidas que ainda precisam ser investigadas. Apresente sua conclusão e explique em quais registros ela se apoia." },
        { type: "question", composition: "focus", title: "Que pergunta você investigaria?", body: "Escolha algo do seu cotidiano. O que você observaria para começar a responder?" }
    ]
};
