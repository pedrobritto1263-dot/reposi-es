// ============================================
// CAMADA DE DEPENDNCIAS (INFRAESTRUTURA)
// ============================================

/**
 * LoggerService - Servio de log
 */
class LoggerService {
  constructor(prefix = "[BIO]") {
    this.prefix = prefix;
    this.logs = [];
  }

  info(message) {
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    const log = { type: "info", timestamp, message };
    this.logs.push(log);
    console.log(`${this.prefix} [INFO] [${timestamp}] ${message}`);
    return log;
  }

  success(message) {
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    const log = { type: "success", timestamp, message };
    this.logs.push(log);
    console.log(`${this.prefix} [SUCCESS] [${timestamp}] ${message}`);
    return log;
  }

  error(message) {
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    const log = { type: "error", timestamp, message };
    this.logs.push(log);
    console.error(`${this.prefix} [ERROR] [${timestamp}] ${message}`);
    return log;
  }

  getLogs() {
    return this.logs;
  }
}

/**
 * StorageRepository - Repositrio de armazenamento
 */
class StorageRepository {
  constructor(storage = localStorage, logger) {
    this.storage = storage;
    this.logger = logger;
    this.avaliacoesKey = "bioimpedancia_avaliacoes";
  }

  getAllAvaliacoes() {
    try {
      const data = this.storage.getItem(this.avaliacoesKey);
      const avaliacoes = data ? JSON.parse(data) : [];
      this.logger.info(`Buscou ${avaliacoes.length} avaliaes do storage`);
      return avaliacoes;
    } catch (error) {
      this.logger.error(`Erro ao buscar avaliaes: ${error.message}`);
      return [];
    }
  }

  saveAvaliacao(avaliacao) {
    try {
      const avaliacoes = this.getAllAvaliacoes();
      avaliacao.id = Date.now();
      avaliacao.dataCriacao = new Date().toISOString();
      avaliacoes.unshift(avaliacao); // Adiciona no incio
      this.storage.setItem(this.avaliacoesKey, JSON.stringify(avaliacoes));
      this.logger.success(`Avaliao salva: ${avaliacao.paciente.nome}`);
      return avaliacao;
    } catch (error) {
      this.logger.error(`Erro ao salvar avaliao: ${error.message}`);
      return null;
    }
  }

  deleteAvaliacao(id) {
    try {
      const avaliacoes = this.getAllAvaliacoes();
      const filtered = avaliacoes.filter((a) => a.id !== id);
      if (filtered.length < avaliacoes.length) {
        this.storage.setItem(this.avaliacoesKey, JSON.stringify(filtered));
        this.logger.success(`Avaliao removida: ID ${id}`);
        return true;
      }
      this.logger.error(`Avaliao no encontrada: ID ${id}`);
      return false;
    } catch (error) {
      this.logger.error(`Erro ao remover avaliao: ${error.message}`);
      return false;
    }
  }
}

// ============================================
// CAMADA DE CLCULO (FRMULAS DE BIOIMPEDNCIA)
// ============================================

/**
 * BioimpedanciaCalculator - Calculadora de bioimpedncia
 * Implementa frmulas baseadas em equaes cientficas
 */
class BioimpedanciaCalculator {
  constructor(logger) {
    this.logger = logger;
    this.logger.info("BioimpedanciaCalculator inicializado");
  }

  /**
   * Calcula a Massa Magra (FFM - Fat Free Mass)
   * Frmula de Kushner (1992) - uma das mais utilizadas
   * FFM = (0.734 * (altura^2 / impedncia)) + (0.116 * peso) + (0.096 * altura) + (0.878 * sexo) - 4.03
   * Onde: sexo = 1 para masculino, 0 para feminino
   */
  calcularMassaMagra(peso, altura, impedancia, genero) {
    const alturaM = altura / 100; // Converte para metros
    const sexo = genero === "masculino" ? 1 : 0;

    // Equao de Kushner adaptada
    const ffm =
      0.734 * (Math.pow(alturaM, 2) / (impedancia / 1000)) +
      0.116 * peso +
      0.096 * alturaM * 100 +
      0.878 * sexo * 10 -
      4.03;

    // Ajuste para valores realistas
    const massaMagraAjustada = Math.max(ffm * 0.85, peso * 0.5);

    this.logger.info(
      `Massa magra calculada: ${massaMagraAjustada.toFixed(2)} kg`,
    );
    return Math.min(massaMagraAjustada, peso * 0.95); // Limite mximo 95% do peso
  }

  /**
   * Calcula a Massa Gorda
   * Massa Gorda = Peso Total - Massa Magra
   */
  calcularMassaGorda(peso, massaMagra) {
    const massaGorda = peso - massaMagra;
    this.logger.info(`Massa gorda calculada: ${massaGorda.toFixed(2)} kg`);
    return Math.max(massaGorda, 0);
  }

  /**
   * Calcula o IMC (ndice de Massa Corporal)
   * IMC = peso / altura^2
   */
  calcularIMC(peso, altura) {
    const alturaM = altura / 100;
    const imc = peso / Math.pow(alturaM, 2);
    this.logger.info(`IMC calculado: ${imc.toFixed(2)}`);
    return imc;
  }

  /**
   * Classifica o IMC segundo a OMS
   */
  classificarIMC(imc) {
    if (imc < 18.5) return { classificacao: "Abaixo do peso", cor: "#29b6f6" };
    if (imc < 25) return { classificacao: "Peso normal", cor: "#00c853" };
    if (imc < 30) return { classificacao: "Sobrepeso", cor: "#ff9800" };
    if (imc < 35) return { classificacao: "Obesidade Grau I", cor: "#ff5722" };
    if (imc < 40) return { classificacao: "Obesidade Grau II", cor: "#f44336" };
    return { classificacao: "Obesidade Grau III", cor: "#b71c1c" };
  }

  /**
   * Calcula a Taxa Metablica Basal (TMB)
   * Frmula de Mifflin-St Jeor (1990) - considerada a mais precisa
   */
  calcularTMB(peso, altura, idade, genero) {
    // Mifflin-St Jeor Equation
    let tmb = 10 * peso + 6.25 * altura - 5 * idade;

    if (genero === "masculino") {
      tmb += 5;
    } else {
      tmb -= 161;
    }

    this.logger.info(`TMB calculada: ${tmb.toFixed(2)} kcal/dia`);
    return tmb;
  }

  /**
   * Calcula a gua Corporal Total
   * Aproximao: 73% da massa magra
   */
  calcularAguaCorporal(massaMagra) {
    const agua = massaMagra * 0.73;
    this.logger.info(`gua corporal calculada: ${agua.toFixed(2)} kg`);
    return agua;
  }

  /**
   * Estima a Massa ssea
   * Aproximao: ~5% do peso corporal para adultos
   */
  calcularMassaOssea(peso, genero) {
    // Mulheres tendem a ter menor densidade ssea
    const percentual = genero === "masculino" ? 0.05 : 0.045;
    const massaOssea = peso * percentual;
    this.logger.info(`Massa ssea estimada: ${massaOssea.toFixed(2)} kg`);
    return massaOssea;
  }

  /**
   * Realiza todos os clculos de bioimpedncia
   */
  calcularTodos(paciente, dadosMedicao) {
    this.logger.info(`Iniciando clculos para: ${paciente.nome}`);

    const { peso, altura, idade, genero } = paciente;
    const { impedancia } = dadosMedicao;

    // Calcula massa magra usando frmula de bioimpedncia
    const massaMagra = this.calcularMassaMagra(
      peso,
      altura,
      impedancia,
      genero,
    );

    // Calcula os demais valores
    const massaGorda = this.calcularMassaGorda(peso, massaMagra);
    const imc = this.calcularIMC(peso, altura);
    const imcClassificacao = this.classificarIMC(imc);
    const tmb = this.calcularTMB(peso, altura, idade, genero);
    const agua = this.calcularAguaCorporal(massaMagra);
    const massaOssea = this.calcularMassaOssea(peso, genero);

    // Calcula percentuais
    const percentualGordura = (massaGorda / peso) * 100;
    const percentualMassaMagra = (massaMagra / peso) * 100;
    const percentualAgua = (agua / peso) * 100;

    this.logger.success(`Clculos completados para ${paciente.nome}`);

    return {
      paciente,
      dadosMedicao,
      resultados: {
        massaMagra: parseFloat(massaMagra.toFixed(2)),
        massaMagraPercent: parseFloat(percentualMassaMagra.toFixed(1)),
        massaGorda: parseFloat(massaGorda.toFixed(2)),
        massaGordaPercent: parseFloat(percentualGordura.toFixed(1)),
        imc: parseFloat(imc.toFixed(2)),
        imcClassificacao: imcClassificacao.classificacao,
        imcCor: imcClassificacao.cor,
        tmb: parseFloat(tmb.toFixed(0)),
        agua: parseFloat(agua.toFixed(2)),
        aguaPercent: parseFloat(percentualAgua.toFixed(1)),
        massaOssea: parseFloat(massaOssea.toFixed(2)),
      },
      dataCalculo: new Date().toISOString(),
    };
  }
}

// ============================================
// CAMADA DE SERVIO (BUSINESS LOGIC)
// ============================================

/**
 * BioimpedanciaService - Servio de negcio
 */
class BioimpedanciaService {
  constructor(calculator, repository, logger) {
    this.calculator = calculator;
    this.repository = repository;
    this.logger = logger;
    this.logger.info("BioimpedanciaService inicializado");
  }

  validarDados(paciente, dadosMedicao) {
    this.logger.info("Validando dados do paciente");

    const erros = [];

    // Validaes bsicas
    if (!paciente.nome || paciente.nome.trim().length < 3) {
      erros.push("Nome deve ter pelo menos 3 caracteres");
    }

    if (!paciente.idade || paciente.idade < 5 || paciente.idade > 100) {
      erros.push("Idade deve estar entre 5 e 100 anos");
    }

    if (!["masculino", "feminino"].includes(paciente.genero)) {
      erros.push("Gnero deve ser masculino ou feminino");
    }

    if (!paciente.altura || paciente.altura < 100 || paciente.altura > 250) {
      erros.push("Altura deve estar entre 100 e 250 cm");
    }

    if (!paciente.peso || paciente.peso < 30 || paciente.peso > 300) {
      erros.push("Peso deve estar entre 30 e 300 kg");
    }

    if (
      !dadosMedicao.impedancia ||
      dadosMedicao.impedancia < 200 ||
      dadosMedicao.impedancia > 1500
    ) {
      erros.push("Impedncia deve estar entre 200 e 1500 ohms");
    }

    if (erros.length > 0) {
      this.logger.error(`Validao falhou: ${erros.join(", ")}`);
    }

    return { valido: erros.length === 0, erros };
  }

  calcularBioimpedancia(paciente, dadosMedicao) {
    this.logger.info(`Calculando bioimpedncia para: ${paciente.nome}`);

    const validacao = this.validarDados(paciente, dadosMedicao);
    if (!validacao.valido) {
      throw new Error(validacao.erros.join("; "));
    }

    // Realiza todos os clculos
    const avaliacao = this.calculator.calcularTodos(paciente, dadosMedicao);

    this.logger.success(
      `Bioimpedncia calculada com sucesso para ${paciente.nome}`,
    );
    return avaliacao;
  }

  salvarAvaliacao(avaliacao) {
    this.logger.info("Salvando avaliao");
    return this.repository.saveAvaliacao(avaliacao);
  }

  listarAvaliacoes() {
    this.logger.info("Listando histrico de avaliaes");
    return this.repository.getAllAvaliacoes();
  }

  removerAvaliacao(id) {
    this.logger.info(`Removendo avaliao: ID ${id}`);
    return this.repository.deleteAvaliacao(id);
  }
}

// ============================================
// CONTAINER DE INJEO DE DEPENDNCIA
// ============================================

const Container = {
  services: {},

  register(name, factory) {
    this.services[name] = factory;
    console.log(`[Container] Servio registrado: ${name}`);
  },

  get(name) {
    const factory = this.services[name];
    if (!factory) {
      throw new Error(`Servio "${name}" no registrado no container.`);
    }
    return factory(Container);
  },

  has(name) {
    return name in this.services;
  },
};

// ============================================
// REGISTRO DAS DEPENDNCIAS
// ============================================

Container.register("logger", () => {
  return new LoggerService("[BioApp]");
});

Container.register("repository", (c) => {
  const logger = c.get("logger");
  return new StorageRepository(localStorage, logger);
});

Container.register("calculator", (c) => {
  const logger = c.get("logger");
  return new BioimpedanciaCalculator(logger);
});

Container.register("service", (c) => {
  const calculator = c.get("calculator");
  const repository = c.get("repository");
  const logger = c.get("logger");
  return new BioimpedanciaService(calculator, repository, logger);
});

// ============================================
// CONTROLLER / UI
// ============================================

class BioimpedanciaController {
  constructor(service, logger) {
    this.service = service;
    this.logger = logger;
    this.patientForm = document.getElementById("patientForm");
    this.resultsCard = document.getElementById("resultsCard");
    this.historyList = document.getElementById("historyList");
    this.logList = document.getElementById("logList");
    this.currentAvaliacao = null;

    this.logger.info("BioimpedanciaController inicializado");
    this.init();
  }

  init() {
    this.bindEvents();
    this.renderHistory();
    this.logger.success("Sistema de bioimpedncia inicializado!");
  }

  bindEvents() {
    this.patientForm.addEventListener("submit", (e) =>
      this.handleFormSubmit(e),
    );
  }

  handleFormSubmit(e) {
    e.preventDefault();

    const paciente = {
      nome: document.getElementById("nome").value,
      idade: parseInt(document.getElementById("idade").value),
      genero: document.getElementById("genero").value,
      altura: parseFloat(document.getElementById("altura").value),
      peso: parseFloat(document.getElementById("peso").value),
    };

    const dadosMedicao = {
      impedancia: parseFloat(document.getElementById("impedancia").value),
    };

    try {
      const avaliacao = this.service.calcularBioimpedancia(
        paciente,
        dadosMedicao,
      );
      this.currentAvaliacao = avaliacao;
      this.renderResultados(avaliacao);
      this.resultsCard.style.display = "block";
      this.resultsCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      this.addLog("Bioimpedncia calculada com sucesso!", "success");
    } catch (error) {
      this.addLog(`Erro: ${error.message}`, "error");
      alert(`Erro: ${error.message}`);
    }
  }

  renderResultados(avaliacao) {
    const { resultados } = avaliacao;

    // Massa Magra
    document.getElementById("massaMagra").textContent =
      `${resultados.massaMagra} kg`;
    document.getElementById("massaMagraPercent").textContent =
      `${resultados.massaMagraPercent}%`;

    // Massa Gorda
    document.getElementById("massaGorda").textContent =
      `${resultados.massaGorda} kg`;
    document.getElementById("massaGordaPercent").textContent =
      `${resultados.massaGordaPercent}%`;

    // IMC
    document.getElementById("imc").textContent = resultados.imc;
    const imcClass = document.getElementById("imcClass");
    imcClass.textContent = resultados.imcClassificacao;
    imcClass.style.color = resultados.imcCor;

    // TMB
    document.getElementById("tmb").textContent = `${resultados.tmb} kcal`;

    // gua
    document.getElementById("agua").textContent = `${resultados.agua} kg`;
    document.getElementById("aguaPercent").textContent =
      `${resultados.aguaPercent}%`;

    // Massa ssea
    document.getElementById("massaOssea").textContent =
      `${resultados.massaOssea} kg`;

    this.logger.info("Resultados renderizados na tela");
  }

  salvarAvaliacao() {
    if (!this.currentAvaliacao) {
      this.addLog("Nenhuma avaliao para salvar", "error");
      return;
    }

    try {
      const salva = this.service.salvarAvaliacao(this.currentAvaliacao);
      if (salva) {
        this.renderHistory();
        this.addLog("Avaliao salva com sucesso!", "success");
        alert("Avaliao salva com sucesso!");
      }
    } catch (error) {
      this.addLog(`Erro ao salvar: ${error.message}`, "error");
    }
  }

  limparResultados() {
    this.resultsCard.style.display = "none";
    this.patientForm.reset();
    this.currentAvaliacao = null;
    this.logger.info("Resultados limpos");
    this.addLog("Formulrio e resultados limpos", "info");
  }

  renderHistory() {
    const avaliacoes = this.service.listarAvaliacoes();

    if (avaliacoes.length === 0) {
      this.historyList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <p>Nenhuma avaliao salva ainda</p>
                </div>
            `;
      return;
    }

    this.historyList.innerHTML = avaliacoes
      .map((avaliacao) => {
        const data = new Date(avaliacao.dataCriacao).toLocaleDateString(
          "pt-BR",
        );
        const { resultados } = avaliacao;

        return `
                <div class="history-item" onclick="app.controller.carregarAvaliacao(${avaliacao.id})">
                    <div class="history-info">
                        <strong>${this.escapeHtml(avaliacao.paciente.nome)}</strong>
                        <div class="history-details">
                            <span>IMC: ${resultados.imc}</span>
                            <span>Gordura: ${resultados.massaGordaPercent}%</span>
                            <span>Massa Magra: ${resultados.massaMagra}kg</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <span class="history-date">${data}</span>
                        <button class="btn-icon" onclick="event.stopPropagation(); app.controller.deletarAvaliacao(${avaliacao.id})" title="Excluir">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
      })
      .join("");

    this.logger.info(`Histrico renderizado: ${avaliacoes.length} avaliaes`);
  }

  carregarAvaliacao(id) {
    const avaliacoes = this.service.listarAvaliacoes();
    const avaliacao = avaliacoes.find((a) => a.id === id);

    if (avaliacao) {
      this.currentAvaliacao = avaliacao;
      this.renderResultados(avaliacao);
      this.resultsCard.style.display = "block";
      this.resultsCard.scrollIntoView({ behavior: "smooth" });
      this.addLog(`Avaliao de ${avaliacao.paciente.nome} carregada`, "info");
    }
  }

  deletarAvaliacao(id) {
    if (confirm("Tem certeza que deseja excluir esta avaliao?")) {
      this.service.removerAvaliacao(id);
      this.renderHistory();

      if (this.currentAvaliacao && this.currentAvaliacao.id === id) {
        this.limparResultados();
      }

      this.addLog("Avaliao excluda", "success");
    }
  }

  addLog(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    const logItem = document.createElement("div");
    logItem.className = `log-item ${type}`;
    logItem.innerHTML = `<span class="log-timestamp">[${timestamp}]</span>${message}`;
    this.logList.insertBefore(logItem, this.logList.firstChild);

    while (this.logList.children.length > 50) {
      this.logList.removeChild(this.logList.lastChild);
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// ============================================
// INICIALIZAO DA APLICAO
// ============================================

let app;

document.addEventListener("DOMContentLoaded", () => {
  console.log("=================================");
  console.log("Iniciando Sistema de Bioimpedncia...");
  console.log("=================================");

  const service = Container.get("service");
  const logger = Container.get("logger");

  app = {
    service,
    logger,
    controller: new BioimpedanciaController(service, logger),
  };

  console.log("=================================");
  console.log("Sistema pronto!");
  console.log("=================================");
});

// ============================================
// EXEMPLO DE TESTE COM MOCK
// ============================================

function criarAmbienteDeTeste() {
  console.log("\n=== MODO DE TESTE COM MOCK ===");

  const mockLogger = {
    info: (msg) => console.log("[MOCK LOG]", msg),
    success: (msg) => console.log("[MOCK SUCCESS]", msg),
    error: (msg) => console.error("[MOCK ERROR]", msg),
  };

  const mockCalculator = {
    calcularTodos: (paciente, dados) => {
      mockLogger.info(`Mock: calculando para ${paciente.nome}`);
      return {
        paciente,
        dadosMedicao: dados,
        resultados: {
          massaMagra: 60.5,
          massaMagraPercent: 75.0,
          massaGorda: 19.5,
          massaGordaPercent: 25.0,
          imc: 24.5,
          imcClassificacao: "Peso normal",
          imcCor: "#00c853",
          tmb: 1800,
          agua: 44.2,
          aguaPercent: 55.0,
          massaOssea: 3.5,
        },
        dataCalculo: new Date().toISOString(),
      };
    },
  };

  const testService = new BioimpedanciaService(
    mockCalculator,
    {
      saveAvaliacao: (a) => a,
      getAllAvaliacoes: () => [],
      deleteAvaliacao: () => true,
    },
    mockLogger,
  );

  const teste = testService.calcularBioimpedancia(
    { nome: "Teste", idade: 30, genero: "masculino", altura: 175, peso: 80 },
    { impedancia: 500 },
  );

  console.log("Resultado do teste:", teste.resultados);
  console.log("\n=== FIM DO MODO DE TESTE ===\n");
}

// Descomente para testar com mocks
// criarAmbienteDeTeste();
