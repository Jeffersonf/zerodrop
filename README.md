# NetFailover GUI 🚀
### Aplicativo Visual de Alternância Automática de Rede (Cabo + Celular 5G)

O **NetFailover** é um aplicativo gráfico moderno para Windows que elimina a necessidade de você ter que **desativar e reativar adaptadores de rede manualmente** sempre que o cabo ou o sinal 5G do celular oscilar.

---

### Recursos da Interface Visual:
* **Cards de Conexão em Tempo Real:** 
  * Exibe status do **Cabo de Rede (Ethernet)** e do **Celular (5G / Wi-Fi)** com badges coloridos (Verde, Amarelo, Vermelho).
  * Exibe IP atribuído, latência real em milissegundos e prioridade de métrica.
* **Badge de Status Geral:** Indica claramente em destaque se o Windows está operando no `MODO NORMAL (Cabo)` ou no `MODO FAILOVER (Celular 5G)`.
* **Zero Tela Preta:** O programa inicia em uma janela visual moderna (Dark Mode) usando `pythonw`, sem abrir prompts de comando.
* **Controles Rápidos:**
  * **Pausar / Iniciar Monitoramento:** Permite pausar as checagens com um clique.
  * **Testar Failover Manual:** Permite simular a troca instantânea para o celular e de volta para o cabo para testar sem precisar puxar cabos.
  * **Restaurar Padrões:** Botão que retorna todas as configurações de rede para o automático do Windows.
* **Console Visual Integrado:** Histórico de eventos e quedas com horário e destaque em cores.

---

### Como Usar:
1. Conecte o **Cabo de Rede** e conecte o **Celular** (via Cabo USB com **Ancoragem USB / USB Tethering** ou via Wi-Fi do celular).
2. Dê um duplo clique no atalho **`NetFailover`** na sua **Área de Trabalho**.
3. Na janela do Windows (UAC), clique em **Sim** para autorizar o gerenciamento de rotas.
4. A interface gráfica abrirá automaticamente pronta e monitorando.

---

### Configurações (`config.json`):
- `check_interval_seconds`: Intervalo entre checagens (padrão: `1.0` segundo).
- `fail_threshold`: Número de falhas consecutivas antes de chavear para o celular (padrão: `2` testes = ~2s).
- `recovery_threshold`: Número de sucessos consecutivos antes de voltar para o cabo (padrão: `3` testes = ~3s).
