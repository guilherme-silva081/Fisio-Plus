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

// ========== CONFIGURAÇÃO: CRIAR CONTA APENAS PARA ADMIN ==========
const MODO_CRIAR_CONTA_APENAS_ADMIN = true;

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
    adicionarBotaoAdmin();
    adicionarLinkSecreto();
    
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
                senha: 'admin',
                dataCadastro: new Date().toISOString(),
                criadoPor: 'sistema',
                isAdmin: true,
                ativo: true
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
        localStorage.setItem('senhaAdmin', 'admin');
        
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
            
            // Verifica se o usuário está ativo
            if (user.ativo === false) {
                console.log('❌ Usuário desativado:', user.email);
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

// ========== FUNÇÃO DE REGISTRO APENAS PARA ADMIN ==========
async function register() {
    // VERIFICAÇÃO: Apenas admin pode criar contas
    if (MODO_CRIAR_CONTA_APENAS_ADMIN && !verificarSeEAdmin()) {
        alert('❌ CRIAÇÃO DE CONTA RESTRITA!\n\nApenas o administrador do sistema pode criar novas contas.\n\nEntre em contato com o administrador para solicitar acesso.');
        return;
    }

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
            criadoPor: currentUser ? currentUser.email : 'admin',
            isAdmin: false,
            ativo: true
        };
        
        usuarios.push(novoUsuario);
        
        console.log('💾 Salvando novo usuário:', novoUsuario);
        const sucesso = await salvarUsuarios(usuarios);
        
        if (sucesso) {
            alert('✅ Conta criada com sucesso! O usuário já pode fazer login.');
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

// ========== FUNÇÃO PARA VERIFICAR SE É ADMIN ==========
function verificarSeEAdmin() {
    if (!currentUser) {
        console.log('❌ Nenhum usuário logado');
        return false;
    }
    
    const emailAdmin = 'admin';
    if (currentUser.email === emailAdmin) {
        console.log('✅ Usuário é admin (email)');
        return true;
    }
    
    const senhaAdmin = 'admin';
    const senhaInserida = localStorage.getItem('senhaAdmin');
    if (senhaInserida === senhaAdmin) {
        console.log('✅ Usuário é admin (senha)');
        return true;
    }
    
    console.log('❌ Usuário não é admin:', currentUser.email);
    return false;
}

function showRegisterForm() {
    // VERIFICAÇÃO: Apenas admin pode acessar formulário de registro
    if (MODO_CRIAR_CONTA_APENAS_ADMIN && !verificarSeEAdmin()) {
        alert('🔒 ACESSO RESTRITO!\n\nA criação de novas contas está disponível apenas para o administrador do sistema.\n\nSe você precisa de uma conta, entre em contato com o administrador.');
        return;
    }
    
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
    
    if (MODO_CRIAR_CONTA_APENAS_ADMIN && loginContainer) {
        if (registerLink) {
            if (verificarSeEAdmin()) {
                registerLink.innerHTML = 'Fisio Plus';
                registerLink.style.color = '#4dff07ff';
                registerLink.style.fontWeight = 'bold';
            } else {
                registerLink.innerHTML = 'Fisio Plus';
                registerLink.style.color = '#4dff07ff';
                registerLink.style.fontWeight = 'normal';
                registerLink.style.cursor = 'not-allowed';
                registerLink.onclick = function(e) {
                    e.preventDefault();
                    alert('🔒 ACESSO RESTRITO!\n\nApenas o administrador pode criar novas contas.\n\nEntre em contato com o administrador para solicitar acesso.');
                };
            }
        }
    } else {
        if (registerLink) {
            registerLink.innerHTML = '📝 Criar Conta';
            registerLink.style.color = '';
            registerLink.style.fontWeight = '';
            registerLink.style.cursor = '';
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
    
    // Verificar pacientes com sessões completas
    verificarPacientesComSessoesCompletas();
    
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
        // Verificar pacientes com sessões completas
        verificarPacientesComSessoesCompletas();
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
            
            if (typeof usuarios === 'object' && usuarios !== null) {
                if (usuarios.usuarios && Array.isArray(usuarios.usuarios)) {
                    usuarios = usuarios.usuarios;
                } else {
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
            #botao-admin {
                bottom: 70px !important;
                right: 10px !important;
                font-size: 14px !important;
                padding: 10px 14px !important;
            }
            
            #botao-sair-admin {
                bottom: 130px !important;
                right: 10px !important;
                font-size: 12px !important;
                padding: 8px 12px !important;
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
            #botao-admin:active,
            #botao-sair-admin:active {
                transform: scale(0.95);
                opacity: 0.8;
            }
        }

        /* Estilos para o calendário */
        .calendar-container {
            position: relative;
        }

        .calendar-popup {
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            padding: 10px;
        }

        .calendar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 2px;
        }

        .calendar-day {
            padding: 5px;
            text-align: center;
            cursor: pointer;
            border-radius: 3px;
        }

        .calendar-day:hover {
            background: #f0f0f0;
        }

        .calendar-day.disabled {
            color: #ccc;
            cursor: not-allowed;
        }

        .calendar-day.selected {
            background: #007bff;
            color: white;
        }

        /* Estilos para o relógio */
        .time-input-container {
            display: flex;
            gap: 5px;
            align-items: center;
        }

        .time-input {
            width: 60px;
            text-align: center;
        }

        .time-separator {
            font-weight: bold;
        }

        /* Estilo para conflito de horário */
        .time-conflict {
            border: 2px solid #dc3545 !important;
            background-color: #f8d7da !important;
        }

        .conflict-warning {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
        }

        /* Estilos para a modal de reativação */
        #campoRedefinir {
            transition: all 0.3s ease;
        }

        .form-check-label {
            cursor: pointer;
        }

        .form-check-input {
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}

function adicionarBotaoAdmin() {
    setTimeout(() => {
        const isAdmin = verificarSeEAdmin();
        
        if (isAdmin) {
            const botaoExistente = document.getElementById('botao-admin');
            const botaoSairExistente = document.getElementById('botao-sair-admin');
            if (botaoExistente) botaoExistente.remove();
            if (botaoSairExistente) botaoSairExistente.remove();
            
            const botao = document.createElement('button');
            botao.innerHTML = '👁️ Cadastros';
            botao.className = 'btn btn-warning btn-sm btn-flutuante';
            botao.onclick = verCadastros;
            botao.id = 'botao-admin';
            
            botao.style.position = 'fixed';
            botao.style.bottom = '80px';
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
            botaoSair.innerHTML = '🚪 Sair Admin';
            botaoSair.className = 'btn btn-danger btn-sm btn-flutuante';
            botaoSair.onclick = sairModoAdmin;
            botaoSair.id = 'botao-sair-admin';
            
            botaoSair.style.position = 'fixed';
            botaoSair.style.bottom = '130px';
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
    if (loginContainer && !verificarSeEAdmin()) {
        const linkSecreto = document.createElement('a');
        linkSecreto.href = '#';
        linkSecreto.innerHTML = '🔧 Acesso Admin';
        linkSecreto.style.position = 'fixed';
        linkSecreto.style.top = '10px';
        linkSecreto.style.right = '10px';
        linkSecreto.style.fontSize = '10px';
        linkSecreto.style.color = '#666';
        linkSecreto.style.textDecoration = 'none';
        linkSecreto.onclick = function(e) {
            e.preventDefault();
            ativarModoAdmin();
        };
        document.body.appendChild(linkSecreto);
    }
}

// ========== FUNÇÕES DO ADMIN ==========

function ativarModoAdmin() {
    const senha = prompt('🔐 Digite a senha de administrador:');
    const senhaAdmin = 'admin';
    
    if (senha === senhaAdmin) {
        localStorage.setItem('senhaAdmin', senha);
        alert('✅ Modo administrador ativado! Recarregando página...');
        setTimeout(() => {
            location.reload();
        }, 1000);
    } else {
        alert('❌ Senha incorreta!');
    }
}

function sairModoAdmin() {
    if (confirm('🚪 Sair do modo administrador?\n\nIsso irá remover seu acesso especial.')) {
        localStorage.removeItem('senhaAdmin');
        const usuarioLogado = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (usuarioLogado.email === 'admin') {
            logout();
        } else {
            alert('✅ Modo administrador desativado! Recarregando página...');
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }
}

// ========== FUNÇÕES PARA GERENCIAR USUÁRIOS ==========

async function verCadastros() {
    if (!verificarSeEAdmin()) {
        alert('❌ ACESSO RESTRITO!\n\nEsta função é apenas para o administrador do sistema.');
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
                                        <th>Status</th>
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
                                                <span class="badge ${usuario.ativo ? 'bg-success' : 'bg-danger'}">
                                                    ${usuario.ativo ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td>
                                                <button class="btn ${usuario.ativo ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleUsuario('${usuario.id}', ${!usuario.ativo})" ${usuario.email === 'admin' ? 'disabled title="Não é possível desativar o admin principal"' : ''}>
                                                    <i class="bi ${usuario.ativo ? 'bi-person-dash' : 'bi-person-check'}"></i> ${usuario.ativo ? 'Desativar' : 'Ativar'}
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
                                <p><strong>Ativos:</strong> <span id="usuarios-ativos">${usuarios.filter(u => u.ativo).length}</span> usuário(s)</p>
                            </div>
                            <div class="col-md-6 text-end">
                                
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

// ========== FUNÇÃO PARA ATIVAR/DESATIVAR USUÁRIO ==========
async function toggleUsuario(usuarioId, novoEstado) {
    try {
        const usuarios = await buscarUsuarios();
        const usuarioIndex = usuarios.findIndex(user => user.id === usuarioId);
        
        if (usuarioIndex === -1) {
            alert('❌ Usuário não encontrado!');
            return;
        }
        
        usuarios[usuarioIndex].ativo = novoEstado;
        
        const sucesso = await salvarUsuarios(usuarios);
        
        if (sucesso) {
            const statusElement = document.querySelector(`#user-row-${usuarioId} .badge`);
            const botaoElement = document.querySelector(`#user-row-${usuarioId} .btn`);
            
            if (statusElement) {
                statusElement.className = novoEstado ? 'badge bg-success' : 'badge bg-danger';
                statusElement.textContent = novoEstado ? 'Ativo' : 'Inativo';
            }
            
            if (botaoElement) {
                botaoElement.className = novoEstado ? 'btn btn-warning btn-sm' : 'btn btn-success btn-sm';
                botaoElement.innerHTML = `<i class="bi ${novoEstado ? 'bi-person-dash' : 'bi-person-check'}"></i> ${novoEstado ? 'Desativar' : 'Ativar'}`;
            }
            
            atualizarContadorUsuarios();
            
            alert(`✅ Usuário ${novoEstado ? 'ativado' : 'desativado'} com sucesso!`);
        } else {
            alert('❌ Erro ao alterar status do usuário. Tente novamente.');
        }
    } catch (error) {
        console.error('Erro ao alterar usuário:', error);
        alert('❌ Erro ao alterar status do usuário: ' + error.message);
    }
}

// ========== FUNÇÃO PARA ATUALIZAR CONTADOR DE USUÁRIOS ==========
function atualizarContadorUsuarios() {
    const tbody = document.querySelector('#modalUsuarios tbody');
    if (tbody) {
        const totalUsuarios = tbody.children.length;
        const usuariosAtivos = Array.from(tbody.querySelectorAll('.badge')).filter(badge => 
            badge.classList.contains('bg-success')
        ).length;
        
        const contadorElement = document.getElementById('total-usuarios');
        const ativosElement = document.getElementById('usuarios-ativos');
        
        if (contadorElement) contadorElement.textContent = totalUsuarios;
        if (ativosElement) ativosElement.textContent = usuariosAtivos;
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
            isAdmin: true,
            ativo: true
        };
        
        usuarios.push(novoAdmin);
        const sucesso = await salvarUsuarios(usuarios);
        
        if (sucesso) {
            alert(`✅ Administrador "${nome}" criado com sucesso!\n\nEmail: ${email}\nSenha: ${senha}`);
            
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
            if (index < colunas.length - 1) {
                let texto = coluna.innerText;
                
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
    // Removido o ícone de sincronização
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
    const now = new Date();
    if (document.getElementById('current-date')) {
        document.getElementById('current-date').textContent = now.toLocaleDateString('pt-BR');
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

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarPacientes);
    }

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
                <button class="btn btn-outline-primary btn-sm" onclick="abrirModalAgendamento(${paciente.id})">
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

// ========== MODAL DE AGENDAMENTO COM CALENDÁRIO E RELÓGIO ==========

function abrirModalAgendamento(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    // Criar modal de agendamento
    const modalHTML = `
        <div class="modal fade" id="modalAgendamento" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Agendar Consulta - ${paciente.nome}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Data da Consulta</label>
                            <input type="date" class="form-control" id="dataConsulta" min="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Horário</label>
                            <div class="time-input-container">
                                <input type="number" class="form-control time-input" id="horaConsulta" min="0" max="23" placeholder="HH" value="14">
                                <span class="time-separator">:</span>
                                <input type="number" class="form-control time-input" id="minutoConsulta" min="0" max="59" placeholder="MM" value="30">
                            </div>
                            <div id="horario-conflito" class="conflict-warning d-none"></div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Valor da Consulta (R$)</label>
                            <input type="number" class="form-control" id="valorConsulta" step="0.01" value="120.00">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Procedimento</label>
                            <select class="form-control" id="procedimentoConsulta">
                                <option value="Fisioterapia Convencional">Fisioterapia Convencional</option>
                                <option value="Pilates">Pilates</option>
                                <option value="Hidroterapia">Hidroterapia</option>
                                <option value="Acupuntura">Acupuntura</option>
                                <option value="Avaliação Inicial">Avaliação Inicial</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="confirmarAgendamento(${pacienteId})">Agendar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remover modal existente se houver
    const modalExistente = document.getElementById('modalAgendamento');
    if (modalExistente) {
        modalExistente.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Adicionar event listeners para validação de horário
    document.getElementById('horaConsulta').addEventListener('input', validarHorario);
    document.getElementById('minutoConsulta').addEventListener('input', validarHorario);
    document.getElementById('dataConsulta').addEventListener('change', verificarConflitoHorario);

    const modal = new bootstrap.Modal(document.getElementById('modalAgendamento'));
    modal.show();
}

function validarHorario() {
    const horaInput = document.getElementById('horaConsulta');
    const minutoInput = document.getElementById('minutoConsulta');
    
    let hora = parseInt(horaInput.value);
    let minuto = parseInt(minutoInput.value);
    
    // Validar hora
    if (hora < 0) hora = 0;
    if (hora > 23) hora = 23;
    
    // Validar minuto
    if (minuto < 0) minuto = 0;
    if (minuto > 59) minuto = 59;
    
    horaInput.value = hora;
    minutoInput.value = minuto.toString().padStart(2, '0');
    
    // Verificar conflito
    verificarConflitoHorario();
}

function verificarConflitoHorario() {
    const dataInput = document.getElementById('dataConsulta').value;
    const horaInput = document.getElementById('horaConsulta').value;
    const minutoInput = document.getElementById('minutoConsulta').value;
    const conflitoElement = document.getElementById('horario-conflito');
    
    if (!dataInput || !horaInput || !minutoInput) return;
    
    const dataConsulta = new Date(dataInput);
    const horaCompleta = `${horaInput.padStart(2, '0')}:${minutoInput.padStart(2, '0')}`;
    
    // Verificar se já existe consulta no mesmo horário
    const conflito = agendaHoje.find(consulta => {
        const dataExistente = new Date(consulta.data);
        const dataConsultaComparar = new Date(dataConsulta);
        
        return dataExistente.toDateString() === dataConsultaComparar.toDateString() && 
               consulta.hora === horaCompleta;
    });
    
    if (conflito) {
        conflitoElement.textContent = `⚠️ Conflito de horário: ${conflito.pacienteNome} já está agendado(a)`;
        conflitoElement.classList.remove('d-none');
        document.getElementById('horaConsulta').classList.add('time-conflict');
        document.getElementById('minutoConsulta').classList.add('time-conflict');
    } else {
        conflitoElement.classList.add('d-none');
        document.getElementById('horaConsulta').classList.remove('time-conflict');
        document.getElementById('minutoConsulta').classList.remove('time-conflict');
    }
}

function confirmarAgendamento(pacienteId) {
    const dataInput = document.getElementById('dataConsulta').value;
    const horaInput = document.getElementById('horaConsulta').value;
    const minutoInput = document.getElementById('minutoConsulta').value;
    const valorInput = document.getElementById('valorConsulta').value;
    const procedimentoInput = document.getElementById('procedimentoConsulta').value;
    
    if (!dataInput || !horaInput || !minutoInput || !valorInput) {
        alert('Preencha todos os campos!');
        return;
    }
    
    // Validar data (não pode ser anterior à data atual)
    const dataConsulta = new Date(dataInput);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (dataConsulta < hoje) {
        alert('❌ Não é possível agendar para uma data passada!');
        return;
    }
    
    const valor = parseFloat(valorInput);
    if (isNaN(valor) || valor <= 0) {
        alert('Valor inválido!');
        return;
    }
    
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    const horaCompleta = `${horaInput.padStart(2, '0')}:${minutoInput.padStart(2, '0')}`;
    
    // Verificar conflito final
    const conflito = agendaHoje.find(consulta => {
        const dataExistente = new Date(consulta.data);
        const dataConsultaComparar = new Date(dataConsulta);
        
        return dataExistente.toDateString() === dataConsultaComparar.toDateString() && 
               consulta.hora === horaCompleta;
    });
    
    if (conflito) {
        alert(`❌ Conflito de horário! ${conflito.pacienteNome} já está agendado(a) para este horário.`);
        return;
    }
    
    const consulta = {
        id: nextConsultaId++,
        pacienteId: paciente.id,
        pacienteNome: paciente.nome,
        data: dataConsulta.toISOString(),
        dataAgendamento: new Date().toISOString(),
        dataDisplay: dataConsulta.toLocaleDateString('pt-BR'),
        hora: horaCompleta,
        procedimento: procedimentoInput,
        valor: valor,
        status: 'agendado'
    };
    
    agendaHoje.push(consulta);
    salvarDadosUsuarioAtual();
    atualizarAgendaHoje();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalAgendamento'));
    modal.hide();
    
    alert(`✅ Consulta agendada para ${consulta.dataDisplay} às ${consulta.hora}! Valor: R$ ${valor.toFixed(2)}`);
}

function realizarSessao(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    if (paciente.sessoesRealizadas >= paciente.sessoesPrescritas) {
        alert('Todas as sessões prescritas já foram realizadas! O paciente será desativado automaticamente.');
        paciente.ativo = false;
        salvarDadosUsuarioAtual();
        atualizarTabelaPacientes();
        return;
    }
    
    const valorInput = prompt('Digite o valor da consulta (R$):', '120.00');
    if (!valorInput) return;
    
    const valor = parseFloat(valorInput.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
        alert('Valor inválido!');
        return;
    }
    
    paciente.sessoesRealizadas++;
    
    // VERIFICAÇÃO AUTOMÁTICA: Desativar paciente se atingiu o limite de sessões
    if (paciente.sessoesRealizadas >= paciente.sessoesPrescritas) {
        paciente.ativo = false;
        console.log(`✅ Paciente ${paciente.nome} atingiu o limite de sessões e foi automaticamente desativado.`);
    }
    
    const consulta = {
        id: nextConsultaId++,
        pacienteId: paciente.id,
        pacienteNome: paciente.nome,
        data: new Date().toISOString(),
        procedimento: 'Fisioterapia Convencional',
        valor: valor,
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
    
    let mensagem = `Sessão registrada com sucesso para ${paciente.nome}! Valor: R$ ${valor.toFixed(2)}`;
    if (!paciente.ativo) {
        mensagem += `\n\n⚠️ ${paciente.nome} atingiu o limite de sessões e foi automaticamente desativado.`;
    }
    alert(mensagem);
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
        
        // VERIFICAÇÃO AUTOMÁTICA: Desativar paciente se atingiu o limite de sessões
        if (paciente.sessoesRealizadas >= paciente.sessoesPrescritas) {
            paciente.ativo = false;
            console.log(`✅ Paciente ${paciente.nome} atingiu o limite de sessões e foi automaticamente desativado.`);
        }
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
    atualizarTabelaPacientes(); // Atualiza automaticamente a tabela de pacientes
    alert('✅ Consulta realizada com sucesso!' + (paciente && !paciente.ativo ? `\n\n⚠️ ${paciente.nome} atingiu o limite de sessões e foi automaticamente desativado.` : ''));
}

// ========== FUNÇÃO PARA VERIFICAR PACIENTES COM SESSÕES COMPLETAS ==========
function verificarPacientesComSessoesCompletas() {
    pacientes.forEach(paciente => {
        if (paciente.ativo && paciente.sessoesRealizadas >= paciente.sessoesPrescritas) {
            paciente.ativo = false;
            console.log(`🔄 Paciente ${paciente.nome} tinha sessões completas e foi automaticamente desativado ao carregar.`);
        }
    });
}

function atualizarAgendaHoje() {
    const agendaList = document.getElementById('agenda-items-list');
    const agendaEmpty = document.getElementById('agenda-empty');
    const agendaItems = document.getElementById('agenda-items');
    
    if (!agendaList) return;
    
    agendaList.innerHTML = '';
    
    // Filtrar apenas consultas futuras ou do dia atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const agendaFiltrada = agendaHoje.filter(consulta => {
        const dataConsulta = new Date(consulta.data);
        return dataConsulta >= hoje;
    });
    
    if (agendaFiltrada.length === 0) {
        if (agendaEmpty) agendaEmpty.classList.remove('d-none');
        if (agendaItems) agendaItems.classList.add('d-none');
        return;
    }
    
    if (agendaEmpty) agendaEmpty.classList.add('d-none');
    if (agendaItems) agendaItems.classList.remove('d-none');
    
    // Ordenar agenda por data e hora
    agendaFiltrada.sort((a, b) => {
        const dataA = new Date(a.data);
        const dataB = new Date(b.data);
        return dataA - dataB;
    });
    
    agendaFiltrada.forEach(consulta => {
        const agendaItem = document.createElement('div');
        agendaItem.className = 'agenda-item';
        
        const dataDisplay = consulta.dataDisplay || new Date(consulta.data).toLocaleDateString('pt-BR');
        
        agendaItem.innerHTML = `
            <div><strong>${dataDisplay} ${consulta.hora}</strong></div>
            <div>${consulta.pacienteNome}</div>
            <div>${consulta.procedimento}</div>
            <div>R$ ${consulta.valor.toFixed(2)}</div>
            <div class="agenda-actions">
                <button class="btn btn-success btn-sm" onclick="realizarConsulta(${consulta.id})" title="Realizar Consulta">
                    <i class="bi bi-check-circle"></i>
                </button>
                <button class="btn btn-warning btn-sm" onclick="remarcarConsulta(${consulta.id})" title="Remarcar Consulta">
                    <i class="bi bi-calendar-check"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="cancelarConsulta(${consulta.id})" title="Cancelar Consulta">
                    <i class="bi bi-x-circle"></i>
                </button>
            </div>
        `;
        agendaList.appendChild(agendaItem);
    });
    
    const consultasHojeElement = document.getElementById('consultas-hoje');
    if (consultasHojeElement) {
        consultasHojeElement.textContent = `Consultas agendadas: ${agendaFiltrada.length}`;
    }
}

// ========== FUNÇÕES PARA REMARCAR E CANCELAR CONSULTAS ==========

function remarcarConsulta(consultaId) {
    const consultaIndex = agendaHoje.findIndex(c => c.id === consultaId);
    if (consultaIndex === -1) return;
    
    const consulta = agendaHoje[consultaIndex];
    const paciente = pacientes.find(p => p.id === consulta.pacienteId);
    
    if (!paciente) return;
    
    // Abrir modal de agendamento com os dados atuais
    const modalHTML = `
        <div class="modal fade" id="modalRemarcacao" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Remarcar Consulta - ${paciente.nome}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Data da Consulta</label>
                            <input type="date" class="form-control" id="dataRemarcacao" min="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Horário</label>
                            <div class="time-input-container">
                                <input type="number" class="form-control time-input" id="horaRemarcacao" min="0" max="23" placeholder="HH">
                                <span class="time-separator">:</span>
                                <input type="number" class="form-control time-input" id="minutoRemarcacao" min="0" max="59" placeholder="MM">
                            </div>
                            <div id="remarcacao-conflito" class="conflict-warning d-none"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="confirmarRemarcacao(${consultaId})">Remarcar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalExistente = document.getElementById('modalRemarcacao');
    if (modalExistente) {
        modalExistente.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Preencher com dados atuais
    const dataAtual = new Date(consulta.data);
    document.getElementById('dataRemarcacao').value = dataAtual.toISOString().split('T')[0];
    
    const [hora, minuto] = consulta.hora.split(':');
    document.getElementById('horaRemarcacao').value = hora;
    document.getElementById('minutoRemarcacao').value = minuto;
    
    // Adicionar event listeners
    document.getElementById('horaRemarcacao').addEventListener('input', validarHorarioRemarcacao);
    document.getElementById('minutoRemarcacao').addEventListener('input', validarHorarioRemarcacao);
    document.getElementById('dataRemarcacao').addEventListener('change', verificarConflitoRemarcacao);

    const modal = new bootstrap.Modal(document.getElementById('modalRemarcacao'));
    modal.show();
}

function validarHorarioRemarcacao() {
    const horaInput = document.getElementById('horaRemarcacao');
    const minutoInput = document.getElementById('minutoRemarcacao');
    
    let hora = parseInt(horaInput.value);
    let minuto = parseInt(minutoInput.value);
    
    // Validar hora
    if (hora < 0) hora = 0;
    if (hora > 23) hora = 23;
    
    // Validar minuto
    if (minuto < 0) minuto = 0;
    if (minuto > 59) minuto = 59;
    
    horaInput.value = hora;
    minutoInput.value = minuto.toString().padStart(2, '0');
    
    verificarConflitoRemarcacao();
}

function verificarConflitoRemarcacao() {
    const dataInput = document.getElementById('dataRemarcacao').value;
    const horaInput = document.getElementById('horaRemarcacao').value;
    const minutoInput = document.getElementById('minutoRemarcacao').value;
    const conflitoElement = document.getElementById('remarcacao-conflito');
    
    if (!dataInput || !horaInput || !minutoInput) return;
    
    const dataConsulta = new Date(dataInput);
    const horaCompleta = `${horaInput.padStart(2, '0')}:${minutoInput.padStart(2, '0')}`;
    
    // Verificar se já existe consulta no mesmo horário (excluindo a própria consulta que está sendo remarcada)
    const conflito = agendaHoje.find(consulta => {
        const dataExistente = new Date(consulta.data);
        const dataConsultaComparar = new Date(dataConsulta);
        
        return dataExistente.toDateString() === dataConsultaComparar.toDateString() && 
               consulta.hora === horaCompleta &&
               consulta.id !== consultaId; // Excluir a própria consulta
    });
    
    if (conflito) {
        conflitoElement.textContent = `⚠️ Conflito de horário: ${conflito.pacienteNome} já está agendado(a)`;
        conflitoElement.classList.remove('d-none');
        document.getElementById('horaRemarcacao').classList.add('time-conflict');
        document.getElementById('minutoRemarcacao').classList.add('time-conflict');
    } else {
        conflitoElement.classList.add('d-none');
        document.getElementById('horaRemarcacao').classList.remove('time-conflict');
        document.getElementById('minutoRemarcacao').classList.remove('time-conflict');
    }
}

function confirmarRemarcacao(consultaId) {
    const dataInput = document.getElementById('dataRemarcacao').value;
    const horaInput = document.getElementById('horaRemarcacao').value;
    const minutoInput = document.getElementById('minutoRemarcacao').value;
    
    if (!dataInput || !horaInput || !minutoInput) {
        alert('Preencha todos os campos!');
        return;
    }
    
    const dataConsulta = new Date(dataInput);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (dataConsulta < hoje) {
        alert('❌ Não é possível remarcar para uma data passada!');
        return;
    }
    
    const horaCompleta = `${horaInput.padStart(2, '0')}:${minutoInput.padStart(2, '0')}`;
    
    // Verificar conflito final
    const conflito = agendaHoje.find(consulta => {
        const dataExistente = new Date(consulta.data);
        const dataConsultaComparar = new Date(dataConsulta);
        
        return dataExistente.toDateString() === dataConsultaComparar.toDateString() && 
               consulta.hora === horaCompleta &&
               consulta.id !== consultaId; // Excluir a própria consulta
    });
    
    if (conflito) {
        alert(`❌ Conflito de horário! ${conflito.pacienteNome} já está agendado(a) para este horário.`);
        return;
    }
    
    const consultaIndex = agendaHoje.findIndex(c => c.id === consultaId);
    if (consultaIndex === -1) return;
    
    const consulta = agendaHoje[consultaIndex];
    consulta.data = dataConsulta.toISOString();
    consulta.dataDisplay = dataConsulta.toLocaleDateString('pt-BR');
    consulta.hora = horaCompleta;
    
    salvarDadosUsuarioAtual();
    atualizarAgendaHoje();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalRemarcacao'));
    modal.hide();
    
    alert(`✅ Consulta remarcada para ${consulta.dataDisplay} às ${consulta.hora}!`);
}

function cancelarConsulta(consultaId) {
    if (!confirm('Deseja cancelar esta consulta?')) return;

    const consultaIndex = agendaHoje.findIndex(c => c.id === consultaId);
    if (consultaIndex === -1) return;

    const consulta = agendaHoje[consultaIndex];
    agendaHoje.splice(consultaIndex, 1);
    salvarDadosUsuarioAtual();
    atualizarAgendaHoje();
    alert('✅ Consulta cancelada com sucesso!');
}

// ========== SISTEMA DE RELATÓRIOS COM FILTRO POR PERÍODO ==========

function atualizarRelatorios() {
    // Esta função agora será chamada pelo filtro de período
    aplicarFiltroRelatorio();
}

function aplicarFiltroRelatorio() {
    const dataInicio = document.getElementById('data-inicio') ? document.getElementById('data-inicio').value : '';
    const dataFim = document.getElementById('data-fim') ? document.getElementById('data-fim').value : '';
    
    let consultasFiltradas = consultas.filter(c => c.status === 'realizado');
    let pacientesAtivosFiltrados = pacientes.filter(p => p.ativo);
    
    // Aplicar filtro de período se as datas estiverem preenchidas
    if (dataInicio && dataFim) {
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        
        consultasFiltradas = consultasFiltradas.filter(consulta => {
            const dataConsulta = new Date(consulta.data);
            return dataConsulta >= inicio && dataConsulta <= fim;
        });
        
        // Para pacientes ativos, considerar os que tiveram consultas no período
        pacientesAtivosFiltrados = pacientes.filter(paciente => 
            paciente.ativo && consultasFiltradas.some(consulta => consulta.pacienteId === paciente.id)
        );
    }
    
    const totalAtendimentosElement = document.getElementById("total-atendimentos");
    if (totalAtendimentosElement) {
        totalAtendimentosElement.textContent = consultasFiltradas.length;
    }
    
    const totalPacientesElement = document.getElementById("total-pacientes");
    if (totalPacientesElement) {
        totalPacientesElement.textContent = pacientesAtivosFiltrados.length;
    }
    
    const totalFaturamentoElement = document.getElementById("total-faturamento");
    if (totalFaturamentoElement) {
        const faturamentoTotal = consultasFiltradas.reduce((total, c) => total + c.valor, 0);
        totalFaturamentoElement.textContent = `R$ ${faturamentoTotal.toFixed(2)}`;
    }
}

function inicializarFiltroRelatorio() {
    // Adicionar inputs de filtro se não existirem
    if (!document.getElementById('filtro-relatorio')) {
        const filtroHTML = `
            <div id="filtro-relatorio" class="card mb-4">
                <div class="card-header">
                    <h6 class="mb-0">📊 Filtro por Período</h6>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-4">
                            <label for="data-inicio" class="form-label">Data Início</label>
                            <input type="date" class="form-control" id="data-inicio">
                        </div>
                        <div class="col-md-4">
                            <label for="data-fim" class="form-label">Data Fim</label>
                            <input type="date" class="form-control" id="data-fim">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">&nbsp;</label>
                            <div>
                                <button class="btn btn-primary" onclick="aplicarFiltroRelatorio()">Aplicar Filtro</button>
                                <button class="btn btn-secondary" onclick="limparFiltroRelatorio()">Limpar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        
        const relatoriosContainer = document.getElementById('pagina-relatorios');
        if (relatoriosContainer) {
            const primeiroCard = relatoriosContainer.querySelector('.card');
            if (primeiroCard) {
                primeiroCard.insertAdjacentHTML('beforebegin', filtroHTML);
            }
        }
        
        // Adicionar event listeners
        document.getElementById('data-inicio').addEventListener('change', aplicarFiltroRelatorio);
        document.getElementById('data-fim').addEventListener('change', aplicarFiltroRelatorio);
    }
}

// ========== CSS PARA A ABA DE RELATÓRIOS ==========
function adicionarCSSRelatorios() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* ========== ESTILOS PARA A ABA DE RELATÓRIOS ========== */
        #pagina-relatorios .card {
            border: none;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 1.5rem;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        #pagina-relatorios .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }

        #pagina-relatorios .card-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px 12px 0 0 !important;
            padding: 1rem 1.5rem;
            border: none;
        }

        #pagina-relatorios .card-header h6 {
            margin: 0;
            font-weight: 600;
            font-size: 1.1rem;
        }

        #pagina-relatorios .card-body {
            padding: 1.5rem;
        }

        /* ========== FILTRO DE PERÍODO ========== */
        #filtro-relatorio {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
        }

        #filtro-relatorio .card-header {
            background: linear-gradient(135deg, #6c757d 0%, #495057 100%) !important;
        }

        #filtro-relatorio .form-label {
            font-weight: 600;
            color: #495057;
            margin-bottom: 0.5rem;
        }

        #filtro-relatorio .form-control {
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 0.75rem;
            transition: all 0.3s ease;
        }

        #filtro-relatorio .form-control:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
        }

        #filtro-relatorio .btn {
            border-radius: 8px;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        #filtro-relatorio .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
        }

        #filtro-relatorio .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }

        /* ========== CARDS DE ESTATÍSTICAS ========== */
        .stats-card {
            text-align: center;
            padding: 1.5rem;
            border-radius: 12px;
            background: white;
            border: 1px solid #e9ecef;
            transition: all 0.3s ease;
        }

        .stats-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1);
        }

        .stats-icon {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            opacity: 0.8;
        }

        .stats-number {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .stats-label {
            font-size: 1rem;
            color: #6c757d;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* ========== TABELA DE RELATÓRIOS ========== */
        #pagina-relatorios .table {
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        #pagina-relatorios .table thead th {
            background: linear-gradient(135deg, #343a40 0%, #495057 100%);
            color: white;
            border: none;
            padding: 1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 0.85rem;
        }

        #pagina-relatorios .table tbody td {
            padding: 1rem;
            vertical-align: middle;
            border-color: #f1f3f4;
        }

        #pagina-relatorios .table tbody tr {
            transition: all 0.3s ease;
        }

        #pagina-relatorios .table tbody tr:hover {
            background-color: #f8f9fa;
            transform: scale(1.01);
        }

        /* ========== BADGES E STATUS ========== */
        .status-badge {
            padding: 0.35rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-realizado {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
        }

        .status-cancelado {
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
            color: white;
        }

        /* ========== RESPONSIVIDADE ========== */
        @media (max-width: 768px) {
            #pagina-relatorios .card-body {
                padding: 1rem;
            }

            .stats-card {
                padding: 1rem;
                margin-bottom: 1rem;
            }

            .stats-number {
                font-size: 2rem;
            }

            .stats-icon {
                font-size: 2rem;
            }

            #pagina-relatorios .table {
                font-size: 0.8rem;
            }

            #pagina-relatorios .table thead th {
                padding: 0.75rem 0.5rem;
                font-size: 0.75rem;
            }

            #pagina-relatorios .table tbody td {
                padding: 0.75rem 0.5rem;
            }

            #filtro-relatorio .btn {
                width: 100%;
                margin-bottom: 0.5rem;
            }

            #filtro-relatorio .col-md-4 {
                margin-bottom: 1rem;
            }
        }

        @media (max-width: 576px) {
            .stats-number {
                font-size: 1.5rem;
            }

            .stats-label {
                font-size: 0.8rem;
            }

            #pagina-relatorios .table {
                font-size: 0.7rem;
            }
        }

        /* ========== ANIMAÇÕES ========== */
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        #pagina-relatorios .card {
            animation: fadeIn 0.5s ease-out;
        }

        #pagina-relatorios .stats-card {
            animation: fadeIn 0.6s ease-out;
        }

        #pagina-relatorios .table {
            animation: fadeIn 0.7s ease-out;
        }

        /* ========== ESTILOS ESPECÍFICOS PARA OS CARDS DE ESTATÍSTICAS ========== */
        .card-atendimentos {
            border-left: 4px solid #007bff;
        }

        .card-pacientes {
            border-left: 4px solid #28a745;
        }

        .card-faturamento {
            border-left: 4px solid #ffc107;
        }

        .card-ticket {
            border-left: 4px solid #dc3545;
        }

        /* ========== MELHORIAS NA TABELA ========== */
        #pagina-relatorios .table-responsive {
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }

        #pagina-relatorios .table tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        #pagina-relatorios .table tbody tr:nth-child(even):hover {
            background-color: #f1f3f4;
        }

        /* ========== BOTÕES NA TABELA ========== */
        #pagina-relatorios .btn-sm {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
            border-radius: 6px;
            transition: all 0.3s ease;
        }

        #pagina-relatorios .btn-sm:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
    `;
    document.head.appendChild(style);
}

// ========== MODIFICAÇÃO NA FUNÇÃO DE INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', function() {
    // ... código existente ...

    // Adicionar CSS específico para relatórios
    adicionarCSSRelatorios();
    
    // ... resto do código de inicialização ...
});

// ========== ATUALIZAR FUNÇÃO DE APLICAR FILTRO PARA MELHORAR VISUALIZAÇÃO ==========
function aplicarFiltroRelatorio() {
    const dataInicio = document.getElementById('data-inicio') ? document.getElementById('data-inicio').value : '';
    const dataFim = document.getElementById('data-fim') ? document.getElementById('data-fim').value : '';
    
    let consultasFiltradas = consultas.filter(c => c.status === 'realizado');
    let pacientesAtivosFiltrados = pacientes.filter(p => p.ativo);
    
    // Aplicar filtro de período se as datas estiverem preenchidas
    if (dataInicio && dataFim) {
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        
        consultasFiltradas = consultasFiltradas.filter(consulta => {
            const dataConsulta = new Date(consulta.data);
            return dataConsulta >= inicio && dataConsulta <= fim;
        });
        
        // Para pacientes ativos, considerar os que tiveram consultas no período
        pacientesAtivosFiltrados = pacientes.filter(paciente => 
            paciente.ativo && consultasFiltradas.some(consulta => consulta.pacienteId === paciente.id)
        );
    }
    
    // Atualizar elementos com animação
    const totalAtendimentosElement = document.getElementById("total-atendimentos");
    const totalPacientesElement = document.getElementById("total-pacientes");
    const totalFaturamentoElement = document.getElementById("total-faturamento");
    
    if (totalAtendimentosElement) {
        totalAtendimentosElement.textContent = consultasFiltradas.length;
        totalAtendimentosElement.style.animation = 'pulse 0.5s ease';
        setTimeout(() => totalAtendimentosElement.style.animation = '', 500);
    }
    
    if (totalPacientesElement) {
        totalPacientesElement.textContent = pacientesAtivosFiltrados.length;
        totalPacientesElement.style.animation = 'pulse 0.5s ease';
        setTimeout(() => totalPacientesElement.style.animation = '', 500);
    }
    
    if (totalFaturamentoElement) {
        const faturamentoTotal = consultasFiltradas.reduce((total, c) => total + c.valor, 0);
        totalFaturamentoElement.textContent = `R$ ${faturamentoTotal.toFixed(2)}`;
        totalFaturamentoElement.style.animation = 'pulse 0.5s ease';
        setTimeout(() => totalFaturamentoElement.style.animation = '', 500);
    }
    
    // Adicionar animação de pulso no CSS
    if (!document.querySelector('#pulse-animation')) {
        const pulseStyle = document.createElement('style');
        pulseStyle.id = 'pulse-animation';
        pulseStyle.innerHTML = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(pulseStyle);
    }
}

function limparFiltroRelatorio() {
    const dataInicio = document.getElementById('data-inicio');
    const dataFim = document.getElementById('data-fim');
    
    if (dataInicio) dataInicio.value = '';
    if (dataFim) dataFim.value = '';
    
    aplicarFiltroRelatorio();
}

// ========== FUNÇÕES RESTANTES DO SISTEMA DE FISIOTERAPIA ==========

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

// ========== CORREÇÃO DA TABELA DE HISTÓRICO DE CONSULTAS ==========

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
        const horaFormatada = new Date(consulta.data).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Calcular duração baseada no procedimento
        const duracao = calcularDuracaoProcedimento(consulta.procedimento);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${dataFormatada} ${horaFormatada}</td>
            <td>${consulta.pacienteNome}</td>
            <td>${consulta.procedimento}</td>
            <td>${duracao} min</td>
            <td>R$ ${consulta.valor.toFixed(2)}</td>
            <td><span class="badge bg-success">Realizado</span></td>
            <td>
                <button class="btn btn-outline-primary btn-sm" onclick="visualizarConsulta(${consulta.id})">
                    <i class="bi bi-eye"></i> Detalhes
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// ========== FUNÇÃO PARA CALCULAR DURAÇÃO DO PROCEDIMENTO ==========

function calcularDuracaoProcedimento(procedimento) {
    const duracaoProcedimentos = {
        'Avaliação Inicial': 60,
        'Fisioterapia Convencional': 45,
        'Pilates': 50,
        'RPG': 60,
        'Acupuntura': 30,
        'Liberação Miofascial': 40,
        'Hidroterapia': 45
    };
    
    return duracaoProcedimentos[procedimento] || 45; // Default 45 minutos
}

// ========== ATUALIZAR FUNÇÃO DE VISUALIZAR CONSULTA ==========

function visualizarConsulta(consultaId) {
    const consulta = consultas.find(c => c.id === consultaId);
    if (!consulta) return;
    
    const dataFormatada = new Date(consulta.data).toLocaleDateString('pt-BR');
    const horaFormatada = new Date(consulta.data).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    document.getElementById("consulta-numero").textContent = consulta.id;
    document.getElementById("consulta-id").textContent = consulta.id;
    document.getElementById("consulta-data").textContent = `${dataFormatada} às ${horaFormatada}`;
    document.getElementById("consulta-paciente").textContent = consulta.pacienteNome;
    document.getElementById("consulta-total").textContent = consulta.valor.toFixed(2);
    
    const tbody = document.getElementById("consulta-procedimentos");
    if (tbody) {
        tbody.innerHTML = "";
        
        tbody.innerHTML += `
            <tr class="item">
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

// ========== ADICIONAR CSS PARA MELHORAR A TABELA ==========

function adicionarCSSParaTabelaConsultas() {
    const style = document.createElement('style');
    style.innerHTML = `
        .table-consultas {
            font-size: 0.875rem;
        }
        
        .table-consultas th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        
        .badge {
            font-size: 0.75rem;
        }
        
        .btn-sm {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
        }
        
        @media (max-width: 768px) {
            .table-consultas {
                font-size: 0.8rem;
            }
            
            .btn-sm {
                padding: 0.2rem 0.4rem;
                font-size: 0.7rem;
            }
        }
    `;
    document.head.appendChild(style);
}

// ========== INICIALIZAR CSS AO CARREGAR ==========

document.addEventListener('DOMContentLoaded', function() {
    adicionarCSSParaTabelaConsultas();
});

// ========== ATUALIZAR FUNÇÃO MOSTRAR PÁGINA PARA CHAMAR CORRETAMENTE ==========

// Na função mostrarPagina, garantir que a tabela de consultas seja atualizada corretamente
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
        atualizarTabelaConsultas(); // AGORA CHAMANDO A FUNÇÃO CORRETA
    } else if (pagina === 'relatorios') {
        inicializarFiltroRelatorio();
        aplicarFiltroRelatorio();
    } else if (pagina === 'pacientes') {
        atualizarTabelaTodosPacientes();
    } else if (pagina === 'relatorio-diario') {
        atualizarRelatorioDiario();
    } else if (pagina === 'inicio') {
        atualizarTabelaPacientes();
    }
}

// ========== FUNÇÃO PARA REATIVAR PACIENTE COM MODAL DE OPÇÕES ==========
function reativarPaciente(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    // Criar modal para opções de reativação
    const modalHTML = `
        <div class="modal fade" id="modalReativacao" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Reativar Paciente - ${paciente.nome}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <strong>Opções de Reativação:</strong><br>
                            Escolha como deseja reativar este paciente.
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Sessões Atuais: ${paciente.sessoesRealizadas}/${paciente.sessoesPrescritas}</label>
                        </div>
                        
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="opcaoReativacao" id="opcaoZerar" value="zerar" checked>
                            <label class="form-check-label" for="opcaoZerar">
                                <strong>Zerar Sessões</strong> - Iniciar novo ciclo de tratamento
                            </label>
                        </div>
                        
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="opcaoReativacao" id="opcaoManter" value="manter">
                            <label class="form-check-label" for="opcaoManter">
                                <strong>Manter Sessões</strong> - Continuar de onde parou
                            </label>
                        </div>
                        
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="opcaoReativacao" id="opcaoRedefinir" value="redefinir">
                            <label class="form-check-label" for="opcaoRedefinir">
                                <strong>Redefinir Total</strong> - Alterar total de sessões prescritas
                            </label>
                        </div>
                        
                        <div id="campoRedefinir" class="mt-2 d-none">
                            <label class="form-label">Novo total de sessões prescritas:</label>
                            <input type="number" class="form-control" id="novasSessoes" min="1" value="${paciente.sessoesPrescritas}">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="confirmarReativacao(${pacienteId})">Reativar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remover modal existente se houver
    const modalExistente = document.getElementById('modalReativacao');
    if (modalExistente) {
        modalExistente.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Adicionar event listeners para mostrar/ocultar campo de redefinição
    document.getElementById('opcaoRedefinir').addEventListener('change', function() {
        document.getElementById('campoRedefinir').classList.toggle('d-none', !this.checked);
    });
    
    document.getElementById('opcaoZerar').addEventListener('change', function() {
        document.getElementById('campoRedefinir').classList.add('d-none');
    });
    
    document.getElementById('opcaoManter').addEventListener('change', function() {
        document.getElementById('campoRedefinir').classList.add('d-none');
    });

    const modal = new bootstrap.Modal(document.getElementById('modalReativacao'));
    modal.show();
}

function confirmarReativacao(pacienteId) {
    const paciente = pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    const opcaoSelecionada = document.querySelector('input[name="opcaoReativacao"]:checked').value;
    let mensagem = `✅ Paciente ${paciente.nome} reativado com sucesso!`;

    switch (opcaoSelecionada) {
        case 'zerar':
            paciente.sessoesRealizadas = 0;
            mensagem += `\n\nSessões zeradas para novo ciclo: 0/${paciente.sessoesPrescritas}`;
            break;
            
        case 'manter':
            // Mantém as sessões atuais
            mensagem += `\n\nSessões mantidas: ${paciente.sessoesRealizadas}/${paciente.sessoesPrescritas}`;
            break;
            
        case 'redefinir':
            const novasSessoes = parseInt(document.getElementById('novasSessoes').value);
            if (isNaN(novasSessoes) || novasSessoes <= 0) {
                alert('Número de sessões inválido!');
                return;
            }
            paciente.sessoesPrescritas = novasSessoes;
            paciente.sessoesRealizadas = 0;
            mensagem += `\n\nNovo ciclo definido: 0/${novasSessoes} sessões`;
            break;
    }

    paciente.ativo = true;
    salvarDadosUsuarioAtual();
    atualizarTabelaTodosPacientes();
    atualizarTabelaPacientes(); // Atualiza a tabela da tela inicial
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalReativacao'));
    modal.hide();
    
    // CORREÇÃO: Voltar automaticamente para a tela inicial
    setTimeout(() => {
        mostrarPagina('inicio');
    }, 500);
    
    alert(mensagem);
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
                    <i class="bi bi-person-check"></i> Reativar
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="excluirPaciente(${paciente.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
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
    
    // REMOVIDO: Botão de impressão
    const botoesAcao = document.querySelector("#consultaModal .modal-footer");
    if (botoesAcao) {
        botoesAcao.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>';
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
        { id: 1, nome: 'Fisioterapia Convencional', valor: 120.00 },
        { id: 2, nome: 'Pilates', valor: 150.00 },
        { id: 3, nome: 'Hidroterapia', valor: 180.00 },
        { id: 4, nome: 'Acupuntura', valor: 100.00 },
        { id: 5, nome: 'Avaliação Inicial', valor: 200.00 }
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
        inicializarFiltroRelatorio();
        aplicarFiltroRelatorio();
    } else if (pagina === 'pacientes') {
        atualizarTabelaTodosPacientes();
    } else if (pagina === 'relatorio-diario') {
        atualizarRelatorioDiario();
    } else if (pagina === 'inicio') {
        atualizarTabelaPacientes(); // Garante que a tabela da tela inicial seja atualizada
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