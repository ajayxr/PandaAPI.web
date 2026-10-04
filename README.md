# PandaAPI Tools

Homepage de ferramentas PandaAPI feita com Vue 3, Vite e Express. Visitantes não precisam criar uma conta. As seis ferramentas usam a API PandaAPI através de um proxy no servidor. O servidor autentica com e-mail e senha, obtém o token Bearer pelo endpoint de login e o mantém apenas em memória.

## Começar

Requer Node.js 20.19+ ou 22.12+.

```sh
npm install
npm run dev
```

Para verificar uma versão de produção:

```sh
npm run build
npm run preview
```

## Integração com a API

O servidor obtém o token JWT Bearer automaticamente pelo endpoint de login da PandaAPI. As credenciais nunca são enviadas ao navegador e não devem ser colocadas no Vue nem em variáveis `VITE_*`.

1. Copie o modelo de configuração:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edite `.env` e informe as credenciais da conta de serviço:

   ```env
   PANDAAPI_EMAIL=seu_email_de_servico
   PANDAAPI_PASSWORD=sua_senha_de_servico
   ```

3. Reinicie o servidor com `npm run dev`. O servidor fará login em `/auth/login`, armazenará o Bearer em memória até perto da expiração e tentará autenticar novamente se receber uma resposta `401`.

As chamadas do navegador passam pelo proxy local, que autentica na PandaAPI no servidor e limita as solicitações a 30 por minuto por endereço IP. O arquivo `.env` não deve ser enviado ao Git. Em produção, configure `PANDAAPI_EMAIL` e `PANDAAPI_PASSWORD` como variáveis de ambiente do serviço.

A documentação pública está disponível em [pandaapi.com.br/swagger/index.html](https://pandaapi.com.br/swagger/index.html).

Para iniciar em produção, execute:

```sh
npm run build
npm start
```

Configure `PORT` no ambiente de produção se a plataforma fornecer uma porta própria. Se o servidor estiver atrás de um proxy reverso confiável, habilite `TRUST_PROXY=true` para que o limite de requisições identifique os endereços IP corretos.

## Privacidade e publicidade

A página não contém autenticação de usuário, formulários de cadastro nem integrações com redes de anúncios. Consultas reais de CNPJ e downloads de PDF são encaminhados à PandaAPI pelo servidor; as credenciais permanecem apenas nas variáveis de ambiente do backend, e o token de acesso é mantido somente em memória.
