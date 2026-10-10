// Regression example supplied by the teacher. No provider call is made by tests.
export const interviewItems = [
    ["ENGLISH INTERVIEW", "A competitive internship has a 15-minute interview entirely in English."],
    ["ONLINE COURSE", "A free preparation course is offered online, but students need a laptop and stable internet every evening."],
    ["UNPAID EXPERIENCE", "A company values candidates who already have 100 hours of unpaid volunteer or internship experience."],
    ["BUILDING ACCESS", "The selection interview takes place on the second floor of an old building. There is no elevator."],
    ["APPLICATION COST", "A university program is free, but the application, documents and transportation cost R$ 600 in total."],
    ["STANDARDIZED TEST", "Everyone takes exactly the same 3-hour written test under the same conditions."],
    ["NETWORKING", "Applicants get extra points for recommendation letters from professionals in the field."],
    ["EXCHANGE PROGRAM", "A school exchange offers excellent opportunities, but families must pay for flights and personal expenses."]
];
export const scoring = "ADVANTAGE +1     NEUTRAL 0     DISADVANTAGE -1";
export const interviewText = interviewItems.map(([title, explanation], index) => `|   |\n| - |\n\n**${index + 1}. ${title}**\n\n${explanation}\n\n**${scoring}**`).join("\n\n");
export const interviewRequest = "Coloque cada número na frente e a explicação completa no verso, mantendo o título, a pontuação e o inglês. Não invente exemplos.";
export const expectedInterviewCards = interviewItems.map(([title, explanation], index) => ({ front: String(index + 1), back: `${title}\n\n${explanation}\n\n${scoring}`, example: "" }));
export const detailedSlide = "A oferta de um curso gratuito não garante, sozinha, igualdade de acesso. Para participar de aulas on-line, o estudante também precisa de equipamento, conexão e tempo disponível. Quem compartilha um celular com a família pode enfrentar dificuldades que não aparecem no preço da inscrição. Por exemplo, uma atividade com horário fixo pode coincidir com responsabilidades de trabalho ou cuidado. A regra é a mesma para todos, mas as condições para cumpri-la podem ser diferentes. Analisar essas condições ajuda a distinguir acesso formal de participação efetiva. Uma possível discussão é quais apoios a escola poderia oferecer, sem presumir que todos os estudantes precisam da mesma solução.";
