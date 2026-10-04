# PandaAPI Tools

Homepage de ferramentas PandaAPI feita com Vue 3, Vite e Express. Visitantes não precisam criar uma conta. As seis ferramentas usam a API PandaAPI através de um proxy no servidor que protege o token Bearer.

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

As rotas de ferramentas da API PandaAPI exigem um token JWT Bearer. Não coloque o token no Vue nem em variáveis `VITE_*`, pois esses valores ficam públicos no navegador.

1. Copie o modelo de configuração:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edite `.env` e substitua `cole_seu_token_bearer_aqui` pelo token de serviço:

   ```env
   PANDAAPI_TOKEN=seu_token_de_servico
   ```

3. Reinicie o servidor com `npm run dev`.

As chamadas do navegador passam pelo proxy local, que acrescenta o token no servidor e limita as solicitações a 30 por minuto por endereço IP. O arquivo `.env` não deve ser enviado ao Git. Em produção, configure `PANDAAPI_TOKEN` como variável de ambiente do serviço.

A documentação pública está disponível em [pandaapi.com.br/swagger/index.html](https://pandaapi.com.br/swagger/index.html).

Para iniciar em produção, execute:

```sh
npm run build
npm start
```

Configure `PORT` no ambiente de produção se a plataforma fornecer uma porta própria. Se o servidor estiver atrás de um proxy reverso confiável, habilite `TRUST_PROXY=true` para que o limite de requisições identifique os endereços IP corretos.

## Privacidade e publicidade

A página não contém autenticação de usuário, formulários de cadastro nem integrações com redes de anúncios. Consultas reais de CNPJ e downloads de PDF são encaminhados à PandaAPI pelo servidor; a credencial permanece apenas nas variáveis de ambiente do backend.
