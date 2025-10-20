// ========== SISTEMA DE AUTENTICAÇÃO E SINCRONIZAÇÃO ==========

const PLANILHA_URL = 'https://script.google.com/macros/s/AKfycbyo7xPPh1L2Lt4BPxWWuFKRNWa-yFN05wOjlf6u6xqMOVY7bxz0wTiaLoNuCI8Aydyd/exec';

// ========== CONFIGURAÇÃO JSONBIN ==========
const JSONBIN_BIN_ID = '68eeda36ae596e708f140725';
const JSONBIN_API_KEY = '$2a$10$bPcOKF5VgV05Sv2APyhSheczwws.teETnIg1Un2LWZSzWCwKFceeG';
const SERVER_URL = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;

// ========== CONFIGURAÇÃO JSONBIN PARA DADOS DOS USUÁRIOS ==========
const JSONBIN_DADOS_ID = '68eed970d0ea881f40a33f5f';
const JSONBIN_DADOS_URL = 'https://api.jsonbin.io/v3/b/' + JSONBIN_DADOS_ID;

// Variáveis para controle de usuário e sincronização
let currentUser = null;
let isOnline = true;
let syncInterval = null;

// Estrutura para armazenar dados de todos os usuários
let dadosUsuarios = {};

// ========== CONFIGURAÇÃO: CRIAR CONTA APENAS PARA DESENVOLVEDOR ==========
const MODO_CRIAR_CONTA_DESENVOLVEDOR = false; // Alterado para false para permitir cadastros

// ========== VARIÁVEIS DO SISTEMA DE FISIOTERAPIA ==========
let pacientes = [];
let consultas = [];
let procedimentos = [];
let agendaHoje = [];
let nextPacienteId = 1;
let nextConsultaId = 1;
let relatorioDiario = {
    data: new Date().toLocaleDateString('pt-BR'),
    totalAtendimentos: 0,
    totalFaturamento: 0,
    atendimentos: []
};

// ========== INICIALIZAÇÃO DO SISTEMA ==========
document.addEventListener('DOMContentLoaded', function() {
    // Verifica autenticação primeiro
    checkAuthStatus();
    setupEventListeners();
    checkOnlineStatus();
    
    // Cria admin padrão se necessário
    criarAdminPadrao();
    
    // Configurações de sincronização
    setInterval(checkOnlineStatus, 30000);
    
    // Adiciona componentes do sistema de autenticação
    adicionarCSSMobile();
    adicionarBotaoDesenvolvedor();
    adicionarBotaoSincronizacao();
    adicionarLinkSecreto();
    adicionarBotaoDebug();
    
    // Configura visibilidade do formulário de registro
    configurarVisibilidadeRegistro();
    
    // Se usuário estiver logado, carrega dados da fisioterapia
    if (currentUser) {
        inicializarDadosFisioterapia();
    }
});

// ========== SISTEMA DE AUTENTICAÇÃO ==========

function checkAuthStatus() {
    const savedUser = localStorage.getItem('currentUser');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (savedUser && rememberMe) {
        currentUser = JSON.parse(savedUser);
        showMainContent();
        loadUserData();
    }
}

function setupEventListeners() {
    // Formulário de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            login();
        });
    }
    
    // Formulário de registro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            register();
        });
    }
}

// ========== FUNÇÃO PARA CRIAR ADMIN PADRÃO ==========
async function criarAdminPadrao() {
    try {
        console.log('🔧 Verificando se precisa criar admin padrão...');
        const usuarios = await buscarUsuarios();
        
        // Verifica se já existe algum usuário admin
        const adminExiste = usuarios.some(user => 
            user && user.email && user.email.toLowerCase() === 'admin'
        );
        
        if (!adminExiste) {
            console.log('👑 Criando usuário admin padrão...');
            
            const adminUsuario = {
                id: 'admin-' + Date.now(),
                nome: 'Administrador',
                email: 'admin',
                senha: 'admin', // SENHA PADRÃO
                dataCadastro: new Date().toISOString(),
                criadoPor: 'sistema',
                isAdmin: true
            };
            
            usuarios.push(adminUsuario);
            await salvarUsuarios(usuarios);
            console.log('✅ Admin padrão criado com sucesso!');
            console.log('📧 Email: admin');
            console.log('🔑 Senha: admin');
        } else {
            console.log('✅ Admin já existe no sistema');
        }
    } catch (error) {
        console.error('❌ Erro ao criar admin padrão:', error);
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Preencha email e senha!');
        return;
    }

    // VERIFICAÇÃO ESPECIAL PARA ADMIN
    if (email === 'admin' && password === 'admin') {
        console.log('🔑 Login direto do admin detectado');
        currentUser = {
            id: 'admin',
            name: 'Administrador',
            email: 'admin'
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('senhaDesenvolvedor', 'admin');
        
        showMainContent();
        alert('🎉 Bem-vindo, Administrador!');
        inicializarDadosFisioterapia();
        return;
    }

    const btn = document.querySelector('#login-form button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Entrando...';
    btn.disabled = true;

    try {
        console.log('🔍 Iniciando processo de login...');
        const usuarios = await buscarUsuarios();
        console.log('👥 Usuários encontrados:', usuarios);
        
        // VERIFICAÇÃO EXTRA DE SEGURANÇA
        if (!Array.isArray(usuarios)) {
            console.error('❌ ERRO CRÍTICO: usuarios não é array:', usuarios);
            alert('❌ Erro no sistema. Recarregue a página.');
            return;
        }
        
        console.log('🔍 Procurando usuário com email:', email);
        
        const usuario = usuarios.find(user => {
            if (!user || typeof user !== 'object') {
                console.log('❌ Usuário inválido:', user);
                return false;
            }
            
            console.log('📝 Verificando usuário:', {
                email: user.email,
                temSenha: !!user.senha,
                emailMatch: user.email && user.email.toLowerCase() === email.toLowerCase(),
                senhaMatch: user.senha === password
            });
            
            const emailMatch = user.email && user.email.toLowerCase() === email.toLowerCase();
            const senhaMatch = user.senha === password;
            
            return emailMatch && senhaMatch;
        });

        if (usuario) {
            console.log('🎉 Usuário encontrado:', usuario);
            currentUser = {
                id: usuario.id,
                name: usuario.nome,
                email: usuario.email
            };
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('rememberMe', 'true');
            
            showMainContent();
            alert(`🎉 Bem-vindo, ${usuario.nome}!`);
            
            // Carrega dados da fisioterapia após login
            inicializarDadosFisioterapia();
        } else {
            console.log('❌ Nenhum usuário encontrado com essas credenciais');
            console.log('📧 Email procurado:', email);
            console.log('🔑 Senha fornecida:', password);
            alert('❌ Email ou senha incorretos!');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        alert('❌ Erro ao fazer login: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function register() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (password !== confirmPassword) {
        alert('As senhas não coincidem!');
        return;
    }

    if (!name || !email || !password) {
        alert('Preencha todos os campos!');
        return;
    }

    const btn = document.querySelector('#register-form button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Cadastrando...';
    btn.disabled = true;

    try {
        console.log('👤 Iniciando cadastro de novo usuário...');
        const usuarios = await buscarUsuarios();
        console.log('👥 Usuários existentes:', usuarios);
        
        // VERIFICAÇÃO MELHORADA
        if (!Array.isArray(usuarios)) {
            console.error('❌ ERRO: usuarios não é array, criando novo array');
            usuarios = [];
        }
        
        // Verifica se email já existe - COM VERIFICAÇÃO MAIS ROBUSTA
        const emailExiste = usuarios.some(user => {
            if (!user || typeof user !== 'object') return false;
            return user.email && user.email.toLowerCase() === email.toLowerCase();
        });
        
        if (emailExiste) {
            alert('❌ Este email já está cadastrado!');
            return;
        }
        
        const novoUsuario = {
            id: Date.now().toString(),
            nome: name,
            email: email,
            senha: password,
            dataCadastro: new Date().toISOString(),
            criadoPor: currentUser ? currentUser.email : 'auto-cadastro'
        };
        
        usuarios.push(novoUsuario);
        
        console.log('💾 Salvando novo usuário:', novoUsuario);
        const sucesso = await salvarUsuarios(usuarios);
        
        if (sucesso) {
            alert('✅ Conta criada com sucesso! Agora você pode fazer login.');
            showLoginForm();
            
            // Limpa o formulário
            document.getElementById('register-name').value = '';
            document.getElementById('register-email').value = '';
            document.getElementById('register-password').value = '';
            document.getElementById('register-confirm-password').value = '';
        } else {
            alert('❌ Erro ao salvar conta. Tente novamente.');
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        alert('❌ Erro ao criar conta: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function showRegisterForm() {
    document.getElementById('login-form').classList.add('d-none');
    document.getElementById('register-form').classList.remove('d-none');
}

function showLoginForm() {
    document.getElementById('register-form').classList.add('d-none');
    document.getElementById('login-form').classList.remove('d-none');
}

function configurarVisibilidadeRegistro() {
    const registerForm = document.getElementById('register-form');
    const registerLink = document.querySelector('a[href="#"]');
    const loginContainer = document.getElementById('login-container');
    
    if (MODO_CRIAR_CONTA_DESENVOLVEDOR && loginContainer) {
        if (registerLink) {
            registerLink.innerHTML = '🔒 Criar Conta (Apenas Desenvolvedor)';
            registerLink.style.color = '#ffc107';
            registerLink.style.fontWeight = 'bold';
        }
    } else {
        if (registerLink) {
            registerLink.innerHTML = '📝 Criar Conta';
            registerLink.style.color = '';
            registerLink.style.fontWeight = '';
        }
    }
}

// ========== SISTEMA DE SINCRONIZAÇÃO ==========

async function buscarDadosUsuarios() {
    try {
        const response = await fetch(JSONBIN_DADOS_URL + '/latest', {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.log('Criando nova estrutura de dados...');
            return {};
        }
        
        const data = await response.json();
        return data.record || {};
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        return {};
    }
}

async function salvarDadosUsuarios() {
    try {
        const response = await fetch(JSONBIN_DADOS_URL, {
            method: 'PUT',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dadosUsuarios)
        });
        
        return response.ok;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        return false;
    }
}

async function salvarDadosUsuarioAtual() {
    if (!currentUser) {
        console.log('❌ Nenhum usuário logado para salvar dados');
        return false;
    }

    console.log('💾 Salvando dados do usuário:', currentUser.id);
    
    try {
        const dadosUsuario = {
            pacientes: pacientes,
            consultas: consultas,
            procedimentos: procedimentos,
            agendaHoje: agendaHoje,
            relatorioDiario: relatorioDiario,
            nextPacienteId: nextPacienteId,
            nextConsultaId: nextConsultaId,
            lastSync: new Date().toISOString()
        };

        dadosUsuarios[currentUser.id] = dadosUsuario;
        
        console.log('☁️ Enviando para nuvem...');
        const sucesso = await salvarDadosUsuarios();
        
        if (sucesso) {
            console.log('✅ Dados do usuário sincronizados na nuvem!');
            salvarDadosLocais();
        } else {
            console.log('❌ Falha ao salvar na nuvem, salvando localmente...');
            salvarDadosLocais();
        }
        
        return sucesso;
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
        salvarDadosLocais();
        return false;
    }
}

async function carregarDadosUsuarioAtual() {
    if (!currentUser) return false;

    console.log('🔄 Carregando dados do usuário:', currentUser.id);
    
    try {
        await carregarDadosUsuariosRemotos();
        
        const dadosUsuario = dadosUsuarios[currentUser.id];
        
        if (dadosUsuario && dadosUsuario.pacientes) {
            console.log('✅ Dados encontrados na nuvem, aplicando...');
            aplicarDadosUsuario(dadosUsuario);
            console.log('✅ Dados carregados do servidor');
            
            salvarDadosLocais();
        } else {
            console.log('ℹ️ Nenhum dado na nuvem, tentando local...');
            carregarDadosLocais();
            console.log('ℹ️ Dados carregados localmente');
            
            if (pacientes.length > 0) {
                console.log('🔼 Sincronizando dados locais com nuvem...');
                await salvarDadosUsuarioAtual();
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        carregarDadosLocais();
        return false;
    }
}

function aplicarDadosUsuario(dados) {
    if (dados.pacientes) pacientes = dados.pacientes;
    if (dados.consultas) consultas = dados.consultas;
    if (dados.procedimentos) procedimentos = dados.procedimentos;
    if (dados.agendaHoje) agendaHoje = dados.agendaHoje;
    if (dados.relatorioDiario) relatorioDiario = dados.relatorioDiario;
    if (dados.nextPacienteId) nextPacienteId = dados.nextPacienteId;
    if (dados.nextConsultaId) nextConsultaId = dados.nextConsultaId;
    
    // Atualiza a UI do sistema de fisioterapia
    atualizarTabelaPacientes();
    atualizarAgendaHoje();
    atualizarRelatorios();
    if (document.getElementById('consultas-table-body')) {
        atualizarTabelaConsultas();
    }
    if (document.getElementById('todos-pacientes-body')) {
        atualizarTabelaTodosPacientes();
    }
}

async function carregarDadosUsuariosRemotos() {
    dadosUsuarios = await buscarDadosUsuarios();
}

function salvarDadosLocais() {
    if (!currentUser) return;
    
    const data = {
        pacientes,
        consultas,
        procedimentos,
        agendaHoje,
        relatorioDiario,
        nextPacienteId,
        nextConsultaId,
        lastUpdate: new Date().toISOString()
    };
    
    localStorage.setItem(`local_${currentUser.id}_data`, JSON.stringify(data));
}

function carregarDadosLocais() {
    if (!currentUser) return;
    
    const localData = localStorage.getItem(`local_${currentUser.id}_data`);
    
    if (localData) {
        const data = JSON.parse(localData);
        aplicarDadosUsuario(data);
    } else {
        inicializarDadosNovoUsuario();
    }
}

function inicializarDadosNovoUsuario() {
    pacientes = [];
    consultas = [];
    agendaHoje = [];
    relatorioDiario = {
        data: new Date().toLocaleDateString('pt-BR'),
        totalAtendimentos: 0,
        totalFaturamento: 0,
        atendimentos: []
    };
    nextPacienteId = 1;
    nextConsultaId = 1;
    
    carregarProcedimentosIniciais();
    carregarPacientesIniciais();
    
    salvarDadosUsuarioAtual();
    salvarDadosLocais();
}

// ========== FUNÇÕES JSONBIN ==========
async function buscarUsuarios() {
    try {
        console.log('🔍 Buscando usuários do JSONBin...');
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.log('❌ Erro ao buscar usuários, retornando array vazio');
            return [];
        }
        
        const data = await response.json();
        console.log('📦 Dados brutos do JSONBin:', data);
        
        let usuarios = data.record;
        
        // CORREÇÃO MELHORADA - Garante que sempre retorna array
        if (!usuarios) {
            console.log('ℹ️ Nenhum dado encontrado, retornando array vazio');
            return [];
        }
        
        if (!Array.isArray(usuarios)) {
            console.warn('⚠️ Dados não são array, convertendo...', usuarios);
            
            // Se for um objeto, tenta extrair valores
            if (typeof usuarios === 'object' && usuarios !== null) {
                // Verifica se tem propriedade 'usuarios'
                if (usuarios.usuarios && Array.isArray(usuarios.usuarios)) {
                    usuarios = usuarios.usuarios;
                } else {
                    // Converte objeto para array de valores
                    usuarios = Object.values(usuarios);
                }
            } else {
                usuarios = [];
            }
        }
        
        // FILTRA: remove entradas inválidas
        usuarios = usuarios.filter(user => 
            user && 
            typeof user === 'object' && 
            user.email && 
            user.senha
        );
        
        console.log(`✅ ${usuarios.length} usuário(s) válido(s) carregado(s)`);
        return usuarios;
        
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        return [];
    }
}

async function salvarUsuarios(usuarios) {
    try {
        console.log('💾 Salvando usuários no JSONBin...');
        
        // GARANTE que é um array antes de salvar
        if (!Array.isArray(usuarios)) {
            console.warn('⚠️ Tentativa de salvar não-array, convertendo...');
            usuarios = [];
        }
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(usuarios)
        });
        
        if (response.ok) {
            console.log(`✅ ${usuarios.length} usuário(s) salvo(s) no JSONBin`);
        } else {
            console.error('❌ Erro ao salvar no JSONBin:', await response.text());
        }
        
        return response.ok;
    } catch (error) {
        console.error('❌ Erro ao salvar usuários:', error);
        return false;
    }
}

// ========== COMPONENTES DA INTERFACE ==========

function adicionarCSSMobile() {
    const style = document.createElement('style');
    style.innerHTML = `
        @media (max-width: 768px) {
            #botao-sincronizar {
                bottom: 70px !important;
                right: 10px !important;
                font-size: 16px !important;
                padding: 12px 16px !important;
                min-width: 70px;
                min-height: 50px;
            }
            
            #botao-desenvolvedor {
                bottom: 130px !important;
                right: 10px !important;
                font-size: 14px !important;
                padding: 10px 14px !important;
            }
            
            #botao-sair-desenvolvedor {
                bottom: 180px !important;
                right: 10px !important;
                font-size: 12px !important;
                padding: 8px 12px !important;
            }

            #botao-debug {
                bottom: 230px !important;
                right: 10px !important;
                font-size: 12px !important;
                padding: 6px 10px !important;
            }
        }
        
        .btn-flutuante {
            z-index: 10000 !important;
            position: fixed !important;
        }
        
        .senha-input {
            font-family: monospace !important;
        }
        
        .btn-eye.active {
            background-color: #6c757d !important;
            border-color: #6c757d !important;
            color: white !important;
        }
        
        @media (hover: none) and (pointer: coarse) {
            #botao-sincronizar:active,
            #botao-desenvolvedor:active,
            #botao-sair-desenvolvedor:active,
            #botao-debug:active {
                transform: scale(0.95);
                opacity: 0.8;
            }
        }
    `;
    document.head.appendChild(style);
}

// ========== FUNÇÃO: DEBUG DO JSONBIN ==========
async function debugJSONBin() {
    try {
        console.log('🐛 INICIANDO DEBUG DO JSONBIN');
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error('❌ Erro na resposta:', response.status);
            alert('❌ Erro ao acessar JSONBin. Verifique a conexão.');
            return;
        }
        
        const data = await response.json();
        console.log('📦 Dados COMPLETOS do JSONBin:', data);
        console.log('📝 Record (usuários):', data.record);
        
        let usuarios = data.record;
        if (!Array.isArray(usuarios)) {
            console.log('❌ Record não é array, tentando converter...');
            if (typeof usuarios === 'object' && usuarios !== null) {
                usuarios = Object.values(usuarios);
            } else {
                usuarios = [];
            }
        }
        
        console.log(`👥 ${usuarios.length} usuário(s) no total:`);
        usuarios.forEach((user, index) => {
            console.log(`   ${index + 1}.`, {
                id: user.id,
                nome: user.nome,
                email: user.email,
                temSenha: !!user.senha,
                senha: user.senha ? '***' + user.senha.slice(-3) : 'N/A'
            });
        });
        
        alert(`🔍 DEBUG: ${usuarios.length} usuário(s) encontrado(s)\nVerifique o console para detalhes.`);
        
    } catch (error) {
        console.error('❌ Erro no debug:', error);
        alert('❌ Erro no debug: ' + error.message);
    }
}

function adicionarBotaoDebug() {
    // const botaoDebug = document.createElement('button');
    botaoDebug.innerHTML = '🐛 Debug';
    botaoDebug.className = 'btn btn-warning btn-sm btn-flutuante';
    botaoDebug.onclick = debugJSONBin;
    botaoDebug.id = 'botao-debug';
    
    botaoDebug.style.position = 'fixed';
    botaoDebug.style.bottom = '230px';
    botaoDebug.style.right = '10px';
    botaoDebug.style.zIndex = '10000';
    botaoDebug.style.fontSize = '12px';
    botaoDebug.style.padding = '6px 10px';
    botaoDebug.style.borderRadius = '20px';
    botaoDebug.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    botaoDebug.style.border = '2px solid #fff';
    botaoDebug.style.fontWeight = 'bold';
    
    document.body.appendChild(botaoDebug);
}

function adicionarBotaoSincronizacao() {
    setTimeout(() => {
        if (currentUser) {
            const botaoExistente = document.getElementById('botao-sincronizar');
            if (botaoExistente) {
                botaoExistente.remove();
            }
            
            const botaoSync = document.createElement('button');
            botaoSync.innerHTML = '🔄 Sync';
            botaoSync.className = 'btn btn-info btn-sm';
            botaoSync.onclick = sincronizarManual;
            botaoSync.id = 'botao-sincronizar';
            
            botaoSync.style.position = 'fixed';
            botaoSync.style.bottom = '80px';
            botaoSync.style.right = '10px';
            botaoSync.style.zIndex = '10000';
            botaoSync.style.fontSize = '14px';
            botaoSync.style.padding = '8px 12px';
            botaoSync.style.borderRadius = '20px';
            botaoSync.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
            botaoSync.style.border = '2px solid #fff';
            botaoSync.style.background = '#17a2b8';
            botaoSync.style.color = 'white';
            botaoSync.style.fontWeight = 'bold';
            
            document.body.appendChild(botaoSync);
        }
    }, 3000);
}

function adicionarBotaoDesenvolvedor() {
    setTimeout(() => {
        const isDesenvolvedor = verificarSeEDesenvolvedor();
        
        if (isDesenvolvedor) {
            const botaoExistente = document.getElementById('botao-desenvolvedor');
            const botaoSairExistente = document.getElementById('botao-sair-desenvolvedor');
            if (botaoExistente) botaoExistente.remove();
            if (botaoSairExistente) botaoSairExistente.remove();
            
            const botao = document.createElement('button');
            botao.innerHTML = '👁️ Cadastros';
            botao.className = 'btn btn-warning btn-sm btn-flutuante';
            botao.onclick = verCadastros;
            botao.id = 'botao-desenvolvedor';
            
            botao.style.position = 'fixed';
            botao.style.bottom = '130px';
            botao.style.right = '10px';
            botao.style.zIndex = '10000';
            botao.style.fontSize = '14px';
            botao.style.padding = '10px 14px';
            botao.style.borderRadius = '20px';
            botao.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
            botao.style.border = '2px solid #fff';
            botao.style.fontWeight = 'bold';
            
            document.body.appendChild(botao);
            
            const botaoSair = document.createElement('button');
            botaoSair.innerHTML = '🚪 Sair Dev';
            botaoSair.className = 'btn btn-danger btn-sm btn-flutuante';
            botaoSair.onclick = sairModoDesenvolvedor;
            botaoSair.id = 'botao-sair-desenvolvedor';
            
            botaoSair.style.position = 'fixed';
            botaoSair.style.bottom = '180px';
            botaoSair.style.right = '10px';
            botaoSair.style.zIndex = '10000';
            botaoSair.style.fontSize = '12px';
            botaoSair.style.padding = '8px 12px';
            botaoSair.style.borderRadius = '20px';
            botaoSair.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
            botaoSair.style.border = '2px solid #fff';
            botaoSair.style.fontWeight = 'bold';
            
            document.body.appendChild(botaoSair);
        }
    }, 1000);
}

function adicionarLinkSecreto() {
    const loginContainer = document.getElementById('login-container');
    if (loginContainer && !verificarSeEDesenvolvedor()) {
        const linkSecreto = document.createElement('a');
        linkSecreto.href = '#';
        linkSecreto.innerHTML = '🔧 Acesso Desenvolvedor';
        linkSecreto.style.position = 'fixed';
        linkSecreto.style.top = '10px';
        linkSecreto.style.right = '10px';
        linkSecreto.style.fontSize = '10px';
        linkSecreto.style.color = '#666';
        linkSecreto.style.textDecoration = 'none';
        linkSecreto.onclick = function(e) {
            e.preventDefault();
            ativarModoDesenvolvedor();
        };
        document.body.appendChild(linkSecreto);
    }
}

// ========== FUNÇÕES DO DESENVOLVEDOR ==========

function verificarSeEDesenvolvedor() {
    const emailDesenvolvedor = 'admin';
    const usuarioLogado = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    if (usuarioLogado.email && usuarioLogado.email === emailDesenvolvedor) {
        return true;
    }
    
    const senhaMestra = 'admin';
    const senhaInserida = localStorage.getItem('senhaDesenvolvedor');
    
    if (senhaInserida === senhaMestra) {
        return true;
    }
    
    return false;
}

function ativarModoDesenvolvedor() {
    const senha = prompt('🔐 Digite a senha de desenvolvedor:');
    const senhaMestra = 'admin';
    
    if (senha === senhaMestra) {
        localStorage.setItem('senhaDesenvolvedor', senha);
        alert('✅ Modo desenvolvedor ativado! Recarregando página...');
        setTimeout(() => {
            location.reload();
        }, 1000);
    } else {
        alert('❌ Senha incorreta!');
    }
}

function sairModoDesenvolvedor() {
    if (confirm('🚪 Sair do modo desenvolvedor?\n\nIsso irá remover seu acesso especial.')) {
        localStorage.removeItem('senhaDesenvolvedor');
        const usuarioLogado = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (usuarioLogado.email === 'admin') {
            logout();
        } else {
            alert('✅ Modo desenvolvedor desativado! Recarregando página...');
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }
}

// ========== FUNÇÕES PARA GERENCIAR USUÁRIOS ==========

async function verCadastros() {
    if (!verificarSeEDesenvolvedor()) {
        alert('❌ ACESSO RESTRITO!\n\nEsta função é apenas para o desenvolvedor do sistema.');
        return;
    }
    
    try {
        const usuarios = await buscarUsuarios();
        
        if (usuarios.length === 0) {
            alert('📊 Nenhum usuário cadastrado ainda.');
            return;
        }
        
        criarModalUsuarios(usuarios);
        
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao carregar usuários.');
    }
}

// ========== FUNÇÃO PARA CRIAR MODAL DE USUÁRIOS ==========
function criarModalUsuarios(usuarios) {
    // Remove modal existente se houver
    const modalExistente = document.getElementById('modalUsuarios');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    const modalHTML = `
        <div class="modal fade" id="modalUsuarios" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">👥 Usuários Cadastrados - Área Admin</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <strong>⚠️ Área Administrativa</strong> - Aqui você pode visualizar e gerenciar todos os usuários do sistema.
                        </div>
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>ID</th>
                                        <th>Nome</th>
                                        <th>Email</th>
                                        <th>Senha</th>
                                        <th>Data Cadastro</th>
                                        <th>Criado Por</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${usuarios.map(usuario => `
                                        <tr id="user-row-${usuario.id}">
                                            <td><small>${usuario.id}</small></td>
                                            <td>${usuario.nome}</td>
                                            <td>${usuario.email}</td>
                                            <td>
                                                <div class="input-group input-group-sm">
                                                    <input type="password" 
                                                           class="form-control senha-input" 
                                                           value="${usuario.senha}" 
                                                           id="senha-${usuario.id}"
                                                           readonly
                                                           style="font-family: monospace;">
                                                    <button class="btn btn-outline-secondary btn-eye" type="button" onclick="toggleSenha('${usuario.id}')">
                                                        <i class="bi bi-eye"></i>
                                                    </button>
                                                </div>
                                            </td>
                                            <td>${new Date(usuario.dataCadastro).toLocaleDateString('pt-BR')}</td>
                                            <td>${usuario.criadoPor || 'N/A'}</td>
                                            <td>
                                                <button class="btn btn-danger btn-sm" onclick="excluirUsuario('${usuario.id}', '${usuario.nome}')" ${usuario.email === 'admin' ? 'disabled title="Não é possível excluir o admin principal"' : ''}>
                                                    <i class="bi bi-trash"></i> Excluir
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <p><strong>Total:</strong> <span id="total-usuarios">${usuarios.length}</span> usuário(s)</p>
                            </div>
                            <div class="col-md-6 text-end">
                                <button class="btn btn-warning btn-sm" onclick="criarUsuarioAdmin()">
                                    <i class="bi bi-person-plus"></i> Criar Novo Admin
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        <button type="button" class="btn btn-info" onclick="exportarUsuarios()">
                            <i class="bi bi-download"></i> Exportar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('modalUsuarios'));
    modal.show();
}

// ========== FUNÇÃO PARA MOSTRAR/OCULTAR SENHA ==========
function toggleSenha(usuarioId) {
    const inputSenha = document.getElementById(`senha-${usuarioId}`);
    const botao = inputSenha.nextElementSibling;
    const icon = botao.querySelector('i');
    
    if (inputSenha.type === 'password') {
        inputSenha.type = 'text';
        icon.className = 'bi bi-eye-slash';
        botao.classList.add('active');
    } else {
        inputSenha.type = 'password';
        icon.className = 'bi bi-eye';
        botao.classList.remove('active');
    }
}

// ========== FUNÇÃO PARA EXCLUIR USUÁRIO ==========
async function excluirUsuario(usuarioId, usuarioNome) {
    if (!confirm(`🚨 ATENÇÃO: Deseja excluir permanentemente o usuário "${usuarioNome}"?\n\nEsta ação não pode ser desfeita e todos os dados deste usuário serão perdidos!`)) {
        return;
    }
    
    try {
        const usuarios = await buscarUsuarios();
        const usuarioIndex = usuarios.findIndex(user => user.id === usuarioId);
        
        if (usuarioIndex === -1) {
            alert('❌ Usuário não encontrado!');
            return;
        }
        
        // Remove o usuário do array
        usuarios.splice(usuarioIndex, 1);
        
        // Salva no JSONBin
        const sucesso = await salvarUsuarios(usuarios);
        
        if (sucesso) {
            // Remove a linha da tabela
            const linha = document.getElementById(`user-row-${usuarioId}`);
            if (linha) {
                linha.remove();
            }
            
            // Atualiza contador
            atualizarContadorUsuarios();
            
            alert(`✅ Usuário "${usuarioNome}" excluído com sucesso!`);
            
            // Se excluiu o usuário atual, faz logout
            if (currentUser && currentUser.id === usuarioId) {
                alert('⚠️ Você excluiu sua própria conta. Fazendo logout...');
                setTimeout(() => {
                    logout();
                }, 2000);
            }
        } else {
            alert('❌ Erro ao excluir usuário. Tente novamente.');
        }
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert('❌ Erro ao excluir usuário: ' + error.message);
    }
}

// ========== FUNÇÃO PARA ATUALIZAR CONTADOR DE USUÁRIOS ==========
function atualizarContadorUsuarios() {
    const tbody = document.querySelector('#modalUsuarios tbody');
    if (tbody) {
        const totalUsuarios = tbody.children.length;
        const contadorElement = document.getElementById('total-usuarios');
        if (contadorElement) {
            contadorElement.textContent = totalUsuarios;
        }
    }
}

// ========== FUNÇÃO PARA CRIAR NOVO USUÁRIO ADMIN ==========
async function criarUsuarioAdmin() {
    const nome = prompt('Digite o nome do novo administrador:');
    if (!nome) return;
    
    const email = prompt('Digite o email do novo administrador:');
    if (!email) return;
    
    const senha = prompt('Digite a senha do novo administrador:');
    if (!senha) return;
    
    try {
        const usuarios = await buscarUsuarios();
        
        // Verifica se email já existe
        const emailExiste = usuarios.some(user => user.email.toLowerCase() === email.toLowerCase());
        if (emailExiste) {
            alert('❌ Este email já está cadastrado!');
            return;
        }
        
        const novoAdmin = {
            id: 'admin-' + Date.now(),
            nome: nome,
            email: email,
            senha: senha,
            dataCadastro: new Date().toISOString(),
            criadoPor: currentUser ? currentUser.email : 'system',
            isAdmin: true
        };
        
        usuarios.push(novoAdmin);
        const sucesso = await salvarUsuarios(usuarios);
        
        if (sucesso) {
            alert(`✅ Administrador "${nome}" criado com sucesso!\n\nEmail: ${email}\nSenha: ${senha}`);
            
            // Recarrega a modal para mostrar o novo usuário
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalUsuarios'));
            modal.hide();
            setTimeout(() => {
                verCadastros();
            }, 500);
        } else {
            alert('❌ Erro ao criar administrador.');
        }
    } catch (error) {
        console.error('Erro ao criar admin:', error);
        alert('❌ Erro ao criar administrador: ' + error.message);
    }
}

// ========== FUNÇÃO PARA EXPORTAR USUÁRIOS ==========
function exportarUsuarios() {
    const tabela = document.querySelector('#modalUsuarios table');
    if (!tabela) return;
    
    let csv = [];
    const linhas = tabela.querySelectorAll('tr');
    
    linhas.forEach(linha => {
        const colunas = linha.querySelectorAll('th, td');
        const linhaArray = [];
        
        colunas.forEach((coluna, index) => {
            // Pula a coluna de ações (última coluna)
            if (index < colunas.length - 1) {
                let texto = coluna.innerText;
                
                // Para coluna de senha, pega o valor do input
                if (coluna.querySelector('.senha-input')) {
                    texto = coluna.querySelector('.senha-input').value;
                }
                
                linhaArray.push(`"${texto}"`);
            }
        });
        
        csv.push(linhaArray.join(','));
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + csv.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `usuarios_${new Date().toLocaleDateString('pt-BR')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('📊 Lista de usuários exportada com sucesso!');
}

// ========== FUNÇÕES DE SINCRONIZAÇÃO ==========

function checkOnlineStatus() {
    isOnline = navigator.onLine;
    updateOnlineStatusUI();
    
    if (isOnline && currentUser) {
        syncPendingData();
    }
}

function updateOnlineStatusUI() {
    const syncIcon = document.getElementById('sync-icon');
    const syncText = document.getElementById('sync-text');
    
    if (syncIcon && syncText) {
        if (isOnline) {
            syncIcon.className = 'bi bi-cloud-check online';
            syncText.textContent = 'Sincronizado';
        } else {
            syncIcon.className = 'bi bi-cloud-slash offline';
            syncText.textContent = 'Offline';
        }
    }
}

async function sincronizarManual() {
    if (!currentUser) return;
    
    const botao = document.getElementById('botao-sincronizar');
    const originalText = botao.innerHTML;
    botao.innerHTML = '⏳ Sincronizando...';
    botao.disabled = true;
    
    try {
        await carregarDadosUsuarioAtual();
        await salvarDadosUsuarioAtual();
        
        botao.innerHTML = '✅ Sincronizado!';
        setTimeout(() => {
            botao.innerHTML = originalText;
            botao.disabled = false;
        }, 2000);
        
        alert('✅ Dados sincronizados entre todos os dispositivos!');
    } catch (error) {
        console.error('Erro na sincronização:', error);
        botao.innerHTML = '❌ Erro';
        setTimeout(() => {
            botao.innerHTML = originalText;
            botao.disabled = false;
        }, 2000);
        alert('❌ Erro na sincronização. Verifique sua conexão.');
    }
}

function setupPeriodicSync() {
    syncInterval = setInterval(async () => {
        if (isOnline && currentUser) {
            console.log('🔄 Sincronização periódica...');
            await salvarDadosUsuarioAtual();
        }
    }, 30000);
}

function syncPendingData() {
    console.log('🔄 Verificando dados pendentes para sincronização...');
}

// ========== FUNÇÕES PRINCIPAIS DA INTERFACE ==========

function showMainContent() {
    document.getElementById('login-container').classList.add('d-none');
    document.getElementById('main-content').classList.remove('d-none');
    
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.name;
    }
    
    carregarDadosUsuarioAtual();
    setupPeriodicSync();
    mostrarPagina('inicio');
}

function logout() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('rememberMe');
    
    document.getElementById('main-content').classList.add('d-none');
    document.getElementById('login-container').classList.remove('d-none');
}

function loadUserData() {
    if (!currentUser) return;
    carregarDadosUsuarioAtual();
}

// ========== SISTEMA DE FISIOTERAPIA - FUNÇÕES ORIGINAIS ==========

function inicializarDadosFisioterapia() {
    // Configura data atual
    const now = new Date();
    if (document.getElementById('current-date')) {
        document.getElementById('current-date').textContent = now.toLocaleDateString('pt-BR');
    }

    // Configura navegação
    const navInicio = document.getElementById('nav-inicio');
    const navConsultas = document.getElementById('nav-consultas');
    const navRelatorios = document.getElementById('nav-relatorios');
    const navPacientes = document.getElementById('nav-pacientes');
    const navRelatorioDiario = document.getElementById('nav-relatorio-diario');

    if (navInicio) navInicio.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('inicio');
    });

    if (navConsultas) navConsultas.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('consultas');
    });

    if (navRelatorios) navRelatorios.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('relatorios');
    });

    if (navPacientes) navPacientes.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('pacientes');
    });

    if (navRelatorioDiario) navRelatorioDiario.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('relatorio-diario');
    });

    // Adiciona evento para filtrar pacientes
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarPacientes);
    }

    // Atualiza todas as visualizações
    atualizarTabelaPacientes();
    atualizarAgendaHoje();
    atualizarRelatorios();
}

// ========== FUNÇÕES DO SISTEMA DE FISIOTERAPIA ==========

function adicionarPaciente() {
    const nome = document.getElementById('nome').value.trim();
    const idade = parseInt(document.getElementById('idade').value);
    const telefone = document.getElementById('telefone').value.trim();
    const diagnostico = document.getElementById('diagnostico').value.trim();
    const sessoes = parseInt(document.getElementById('sessoes').value);

    if (!nome || isNaN(idade) || idade <= 0 || isNaN(sessoes) || sessoes <= 0) {
        alert('Preencha todos os campos obrigatórios corretamente!');
        return;
    }

    pacientes.push({
        id: nextPacienteId++,
        nome: nome,
        idade: idade,
        telefone: telefone,
        diagnostico: diagnostico,
        sessoesPrescritas: sessoes,
        sessoesRealizadas: 0,
        ativo: true
    });

    salvarDadosUsuarioAtual();
    atualizarTabelaPacientes();
    document.getElementById('novoPacienteForm').reset();
    alert('Paciente cadastrado com sucesso!');
}

function atualizarTabelaPacientes() {
    const tableBody = document.getElementById('pacientes-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const pacientesAtivos = pacientes.filter(p => p.ativo);
    
    if (pacientesAtivos.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">Nenhum paciente cadastrado.</td>
            </tr>
        `;
        return;
    }
    
    pacientesAtivos.forEach(paciente => {
        const row = document.createElement('tr');
        row.className = 'paciente-row';
        row.id = `paciente-${paciente.id}`;
        
        let sessoesClass = 'good-sessoes';
        const sessoesRestantes = paciente.sessoesPrescritas - paciente.sessoesRealizadas;
        if (sessoesRestantes <= 3) sessoesClass = 'low-sessoes';
        if (sessoesRestantes > 10) sessoesClass = 'high-sessoes';
        
        row.innerHTML = `
            <td>${paciente.nome}</td>
            <td>${paciente.idade} anos</td>
            <td>${paciente.diagnostico || 'Não informado'}</td>
            <td>
                <span class="sessoes-cell ${sessoesClass}">
                    ${paciente.sessoesRealizadas}/${paciente.sessoesPrescritas}
                </span>
            </td>
            <td>
                <button class="btn btn-outline-primary btn-sm" onclick="agendarConsulta(${paciente.id})">
                    <i class="bi bi-calendar-plus"></i> Agendar
                </button>
            </td>
            <td>
                <div class="paciente-actions">
                    <button class="btn btn-outline-success btn-sm" onclick="realizarSessao(${paciente.id})">
                        <i class="bi bi-check-circle"></i>
                    </button>
                    <button class="btn btn-outline-warning btn-sm" onclick="editarPaciente(${paciente.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="desativarPaciente(${paciente.id})">
                        <i class="bi bi-person-dash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function realizarSessao(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    if (paciente.sessoesRealizadas >= paciente.sessoesPrescritas) {
        alert('Todas as sessões prescritas já foram realizadas!');
        return;
    }
    
    paciente.sessoesRealizadas++;
    
    const consulta = {
        id: nextConsultaId++,
        pacienteId: paciente.id,
        pacienteNome: paciente.nome,
        data: new Date().toISOString(),
        procedimento: 'Fisioterapia Convencional',
        valor: 120.00,
        duracao: 60,
        status: 'realizado'
    };
    
    consultas.push(consulta);
    
    const hoje = new Date().toLocaleDateString('pt-BR');
    if (relatorioDiario.data === hoje) {
        relatorioDiario.totalAtendimentos++;
        relatorioDiario.totalFaturamento += consulta.valor;
        relatorioDiario.atendimentos.push({
            id: consulta.id,
            hora: new Date().toLocaleTimeString('pt-BR'),
            paciente: paciente.nome,
            procedimento: consulta.procedimento,
            valor: consulta.valor
        });
    }
    
    salvarDadosUsuarioAtual();
    atualizarTabelaPacientes();
    alert('Sessão registrada com sucesso para ' + paciente.nome);
}

function agendarConsulta(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    const hora = prompt('Digite o horário para a consulta (ex: 14:30):');
    if (!hora) return;
    
    const consulta = {
        id: nextConsultaId++,
        pacienteId: paciente.id,
        pacienteNome: paciente.nome,
        data: new Date().toISOString(),
        hora: hora,
        procedimento: 'Fisioterapia Convencional',
        valor: 120.00,
        duracao: 60,
        status: 'agendado'
    };
    
    agendaHoje.push(consulta);
    salvarDadosUsuarioAtual();
    atualizarAgendaHoje();
    alert('Consulta agendada para ' + hora);
}

function editarPaciente(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    const novoSessoes = parseInt(prompt('Novo total de sessões prescritas:', paciente.sessoesPrescritas));
    if (isNaN(novoSessoes) || novoSessoes <= 0) return;
    
    paciente.sessoesPrescritas = novoSessoes;
    salvarDadosUsuarioAtual();
    atualizarTabelaPacientes();
    alert('Sessões atualizadas com sucesso!');
}

function desativarPaciente(pacienteId) {
    if (confirm("Deseja realmente desativar este paciente?")) {
        const paciente = pacientes.find(p => p.id === pacienteId);
        if (paciente) {
            paciente.ativo = false;
            salvarDadosUsuarioAtual();
            atualizarTabelaPacientes();
            alert('Paciente desativado com sucesso!');
        }
    }
}

function atualizarAgendaHoje() {
    const agendaList = document.getElementById('agenda-items-list');
    const agendaEmpty = document.getElementById('agenda-empty');
    const agendaItems = document.getElementById('agenda-items');
    
    if (!agendaList) return;
    
    agendaList.innerHTML = '';
    
    if (agendaHoje.length === 0) {
        if (agendaEmpty) agendaEmpty.classList.remove('d-none');
        if (agendaItems) agendaItems.classList.add('d-none');
        return;
    }
    
    if (agendaEmpty) agendaEmpty.classList.add('d-none');
    if (agendaItems) agendaItems.classList.remove('d-none');
    
    agendaHoje.forEach(consulta => {
        const agendaItem = document.createElement('div');
        agendaItem.className = 'agenda-item';
        agendaItem.innerHTML = `
            <div>${consulta.hora} - ${consulta.pacienteNome}</div>
            <div>${consulta.procedimento}</div>
            <div>R$ ${consulta.valor.toFixed(2)}</div>
            <button class="btn btn-success btn-sm" onclick="realizarConsulta(${consulta.id})">
                <i class="bi bi-check-circle"></i>
            </button>
        `;
        agendaList.appendChild(agendaItem);
    });
    
    const consultasHojeElement = document.getElementById('consultas-hoje');
    if (consultasHojeElement) {
        consultasHojeElement.textContent = `Consultas hoje: ${agendaHoje.length}`;
    }
}

function realizarConsulta(consultaId) {
    const consultaIndex = agendaHoje.findIndex(c => c.id === consultaId);
    if (consultaIndex === -1) return;
    
    const consulta = agendaHoje[consultaIndex];
    consulta.status = 'realizado';
    consulta.data = new Date().toISOString();
    
    consultas.push(consulta);
    agendaHoje.splice(consultaIndex, 1);
    
    const paciente = pacientes.find(p => p.id === consulta.pacienteId);
    if (paciente) {
        paciente.sessoesRealizadas++;
    }
    
    const hoje = new Date().toLocaleDateString('pt-BR');
    if (relatorioDiario.data === hoje) {
        relatorioDiario.totalAtendimentos++;
        relatorioDiario.totalFaturamento += consulta.valor;
        relatorioDiario.atendimentos.push({
            id: consulta.id,
            hora: new Date().toLocaleTimeString('pt-BR'),
            paciente: consulta.pacienteNome,
            procedimento: consulta.procedimento,
            valor: consulta.valor
        });
    }
    
    salvarDadosUsuarioAtual();
    atualizarAgendaHoje();
    alert('Consulta realizada com sucesso!');
}

function atualizarRelatorios() {
    const totalAtendimentosElement = document.getElementById("total-atendimentos");
    if (totalAtendimentosElement) {
        const totalAtendimentos = consultas.filter(c => c.status === 'realizado').length;
        totalAtendimentosElement.textContent = totalAtendimentos;
    }
    
    const totalPacientesElement = document.getElementById("total-pacientes");
    if (totalPacientesElement) {
        const totalPacientes = pacientes.filter(p => p.ativo).length;
        totalPacientesElement.textContent = totalPacientes;
    }
    
    const totalFaturamentoElement = document.getElementById("total-faturamento");
    if (totalFaturamentoElement) {
        const faturamentoTotal = consultas
            .filter(c => c.status === 'realizado')
            .reduce((total, c) => total + c.valor, 0);
        totalFaturamentoElement.textContent = `R$ ${faturamentoTotal.toFixed(2)}`;
    }
}

function atualizarTabelaConsultas() {
    const tableBody = document.getElementById('consultas-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const consultasRealizadas = consultas.filter(c => c.status === 'realizado');
    
    if (consultasRealizadas.length === 0) {
        const consultasEmpty = document.getElementById('consultas-empty');
        if (consultasEmpty) {
            consultasEmpty.classList.remove('d-none');
        }
        return;
    }
    
    const consultasEmpty = document.getElementById('consultas-empty');
    if (consultasEmpty) {
        consultasEmpty.classList.add('d-none');
    }
    
    const consultasOrdenadas = [...consultasRealizadas].sort((a, b) => new Date(b.data) - new Date(a.data));
    
    consultasOrdenadas.forEach(consulta => {
        const dataFormatada = new Date(consulta.data).toLocaleDateString('pt-BR');
        const statusClass = consulta.status === 'realizado' ? 'status-realizado' : 'status-agendado';
        const statusText = consulta.status === 'realizado' ? 'Realizado' : 'Agendado';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${dataFormatada}</td>
            <td>${consulta.pacienteNome}</td>
            <td>${consulta.procedimento}</td>
            <td>${consulta.duracao} min</td>
            <td>R$ ${consulta.valor.toFixed(2)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-outline-primary btn-sm" onclick="visualizarConsulta(${consulta.id})">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function atualizarTabelaTodosPacientes() {
    const tableBody = document.getElementById('todos-pacientes-body');
    if (!tableBody) return;
    
    const pacientesEmpty = document.getElementById('pacientes-empty');
    
    tableBody.innerHTML = '';
    
    if (pacientes.length === 0) {
        if (pacientesEmpty) pacientesEmpty.classList.remove('d-none');
        return;
    }
    
    if (pacientesEmpty) pacientesEmpty.classList.add('d-none');
    
    pacientes.forEach(paciente => {
        const statusClass = paciente.ativo ? 'status-realizado' : 'status-cancelado';
        const statusText = paciente.ativo ? 'Ativo' : 'Inativo';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${paciente.nome}</td>
            <td>${paciente.idade} anos</td>
            <td>${paciente.telefone || 'Não informado'}</td>
            <td>${paciente.diagnostico || 'Não informado'}</td>
            <td>${paciente.sessoesRealizadas}/${paciente.sessoesPrescritas}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-outline-success btn-sm" onclick="reativarPaciente(${paciente.id})" ${paciente.ativo ? 'disabled' : ''}>
                    <i class="bi bi-person-check"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="excluirPaciente(${paciente.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function reativarPaciente(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (paciente) {
        paciente.ativo = true;
        salvarDadosUsuarioAtual();
        atualizarTabelaTodosPacientes();
        alert('Paciente reativado com sucesso!');
    }
}

function excluirPaciente(pacienteId) {
    if (confirm("Deseja excluir permanentemente este paciente?")) {
        pacientes = pacientes.filter(p => p.id !== pacienteId);
        salvarDadosUsuarioAtual();
        atualizarTabelaTodosPacientes();
        alert('Paciente excluído permanentemente!');
    }
}

function atualizarRelatorioDiario() {
    verificarResetDiario();
    
    const dataHojeElement = document.getElementById('data-hoje');
    const totalAtendimentosHojeElement = document.getElementById('total-atendimentos-hoje');
    const faturamentoHojeElement = document.getElementById('faturamento-hoje');
    const ticketMedioHojeElement = document.getElementById('ticket-medio-hoje');
    const tbody = document.getElementById('atendimentos-hoje-body');
    
    if (dataHojeElement) dataHojeElement.textContent = relatorioDiario.data;
    if (totalAtendimentosHojeElement) totalAtendimentosHojeElement.textContent = relatorioDiario.totalAtendimentos;
    if (faturamentoHojeElement) faturamentoHojeElement.textContent = `R$ ${relatorioDiario.totalFaturamento.toFixed(2)}`;
    
    if (ticketMedioHojeElement) {
        const ticketMedio = relatorioDiario.totalAtendimentos > 0 ? relatorioDiario.totalFaturamento / relatorioDiario.totalAtendimentos : 0;
        ticketMedioHojeElement.textContent = `R$ ${ticketMedio.toFixed(2)}`;
    }
    
    if (tbody) {
        tbody.innerHTML = '';
        
        if (relatorioDiario.atendimentos.length > 0) {
            relatorioDiario.atendimentos.slice().reverse().forEach(atendimento => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${atendimento.hora}</td>
                    <td>${atendimento.paciente}</td>
                    <td>${atendimento.procedimento}</td>
                    <td>R$ ${atendimento.valor.toFixed(2)}</td>
                    <td><span class="status-badge status-realizado">Realizado</span></td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Nenhum atendimento hoje</td></tr>';
        }
    }
}

function verificarResetDiario() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    if (relatorioDiario.data !== hoje) {
        relatorioDiario = {
            data: hoje,
            totalAtendimentos: 0,
            totalFaturamento: 0,
            atendimentos: []
        };
    }
}

function visualizarConsulta(consultaId) {
    const consulta = consultas.find(c => c.id === consultaId);
    if (!consulta) return;
    
    document.getElementById("consulta-numero").textContent = consulta.id;
    document.getElementById("consulta-id").textContent = consulta.id;
    document.getElementById("consulta-data").textContent = new Date(consulta.data).toLocaleDateString('pt-BR');
    document.getElementById("consulta-paciente").textContent = consulta.pacienteNome;
    document.getElementById("consulta-total").textContent = consulta.valor.toFixed(2);
    
    const tbody = document.getElementById("consulta-procedimentos");
    if (tbody) {
        tbody.innerHTML = "";
        
        tbody.innerHTML += `
            <tr>
                <td>${consulta.procedimento}</td>
                <td>R$ ${consulta.valor.toFixed(2)}</td>
            </tr>
        `;
    }
    
    const modalElement = document.getElementById("consultaModal");
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function filtrarPacientes() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const linhas = document.querySelectorAll('.paciente-row');
    
    linhas.forEach(linha => {
        const nomePaciente = linha.querySelector('td:first-child')?.textContent.toLowerCase() || '';
        linha.style.display = nomePaciente.includes(query) ? '' : 'none';
    });
}

function carregarProcedimentosIniciais() {
    procedimentos = [
        { id: 1, nome: 'Fisioterapia Convencional', valor: 120.00, duracao: 60 },
        { id: 2, nome: 'Pilates', valor: 150.00, duracao: 60 },
        { id: 3, nome: 'Hidroterapia', valor: 180.00, duracao: 45 },
        { id: 4, nome: 'Acupuntura', valor: 100.00, duracao: 30 },
        { id: 5, nome: 'Avaliação Inicial', valor: 200.00, duracao: 60 }
    ];
}

function carregarPacientesIniciais() {
    pacientes = [
        { 
            id: nextPacienteId++, 
            nome: 'Maria Silva', 
            idade: 45, 
            telefone: '(11) 99999-9999', 
            diagnostico: 'Lombalgia crônica', 
            sessoesPrescritas: 12, 
            sessoesRealizadas: 3, 
            ativo: true 
        },
        { 
            id: nextPacienteId++, 
            nome: 'João Santos', 
            idade: 62, 
            telefone: '(11) 98888-8888', 
            diagnostico: 'Artrose no joelho', 
            sessoesPrescritas: 20, 
            sessoesRealizadas: 15, 
            ativo: true 
        }
    ];
}

// ========== FUNÇÃO PARA MOSTRAR PÁGINAS ==========
function mostrarPagina(pagina) {
    const paginas = [
        'pagina-inicio',
        'pagina-consultas', 
        'pagina-relatorios',
        'pagina-pacientes',
        'pagina-relatorio-diario'
    ];
    
    paginas.forEach(p => {
        const elemento = document.getElementById(p);
        if (elemento) {
            elemento.classList.add('d-none');
        }
    });
    
    const paginaElemento = document.getElementById(`pagina-${pagina}`);
    if (paginaElemento) {
        paginaElemento.classList.remove('d-none');
    }
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const navElement = document.getElementById(`nav-${pagina}`);
    if (navElement) {
        navElement.classList.add('active');
    }
    
    if (pagina === 'consultas') {
        atualizarTabelaConsultas();
    } else if (pagina === 'relatorios') {
        atualizarRelatorios();
    } else if (pagina === 'pacientes') {
        atualizarTabelaTodosPacientes();
    } else if (pagina === 'relatorio-diario') {
        atualizarRelatorioDiario();
    }
}

// Inicialização do sistema de fisioterapia
document.addEventListener('DOMContentLoaded', function() {
    const now = new Date();
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        currentDateElement.textContent = now.toLocaleDateString('pt-BR');
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarPacientes);
    }

    const navInicio = document.getElementById('nav-inicio');
    const navConsultas = document.getElementById('nav-consultas');
    const navRelatorios = document.getElementById('nav-relatorios');
    const navPacientes = document.getElementById('nav-pacientes');
    const navRelatorioDiario = document.getElementById('nav-relatorio-diario');

    if (navInicio) navInicio.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('inicio');
    });

    if (navConsultas) navConsultas.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('consultas');
    });

    if (navRelatorios) navRelatorios.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('relatorios');
    });

    if (navPacientes) navPacientes.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('pacientes');
    });
    
    if (navRelatorioDiario) navRelatorioDiario.addEventListener('click', function(e) {
        e.preventDefault();
        mostrarPagina('relatorio-diario');
    });
    
    mostrarPagina('inicio');
});