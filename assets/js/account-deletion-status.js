(() => {
    const client = window.educariaAccountDeletion;
    const message = document.querySelector("[data-deletion-status]");
    const help = document.querySelector("[data-deletion-help]");
    const refresh = document.querySelector("[data-deletion-refresh]");
    let timer;
    let busy = false;
    async function update() {
        if (busy) return;
        clearTimeout(timer);
        const pending = client.read();
        if (!pending) {
            message.textContent = "Não há comprovante de exclusão neste navegador.";
            help.textContent = "Se você solicitou a exclusão em outro dispositivo, consulte o andamento por ele. Limpar os dados do navegador remove o comprovante, mas não cancela a solicitação.";
            refresh.hidden = true;
            return;
        }
        busy = true;
        refresh.disabled = true;
        try {
            const result = await client.status(pending);
            if (["pending", "retrying", "completed"].includes(result.status)) {
                try { client.clearLocalData(pending.uid); } catch { /* Remote progress is independent of local storage. */ }
            }
            if (result.status === "completed") {
                message.textContent = "Exclusão concluída. Seu acesso, perfil, turmas e materiais foram removidos da plataforma.";
                help.textContent = "Registros mínimos de consumo e segurança seguem os prazos de retenção. Cópias locais em outros dispositivos e arquivos exportados não são apagados remotamente.";
                try { client.clear(pending.receipt); } catch { /* Completion is already confirmed by the server. */ }
                refresh.hidden = true;
                document.querySelector("[data-deletion-login]").href = "login.html?accountDeleted=1";
                return;
            }
            if (result.status === "not_found") {
                message.textContent = "Não encontramos a confirmação da solicitação.";
                help.textContent = "Se acabou de solicitar, aguarde e atualize. Se sua conta ainda permite entrar, volte às Configurações e tente novamente. Não há confirmação de exclusão dos dados.";
            } else {
                message.textContent = result.status === "retrying"
                    ? "A exclusão ainda não terminou. O serviço encontrou uma falha e tentará continuar automaticamente."
                    : "Solicitação registrada. A exclusão está em andamento.";
                help.textContent = "Você pode fechar esta página e voltar pelo link no login. O processo continua enquanto o servidor estiver ativo; pausas do serviço podem atrasar a conclusão. Se a situação persistir, procure o suporte.";
            }
        } catch {
            message.textContent = "Não foi possível consultar o andamento agora. Isso não significa que a exclusão falhou.";
            help.textContent = "Seu comprovante continua salvo. Confira sua conexão e tente novamente em instantes.";
        } finally {
            busy = false;
            refresh.disabled = false;
            if (!refresh.hidden) timer = setTimeout(update, 30_000);
        }
    }
    refresh.addEventListener("click", update);
    window.addEventListener("online", update);
    update();
})();
