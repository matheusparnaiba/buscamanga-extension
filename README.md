<div align="center">

<img src="assets/buscamanga-rounded.png" alt="BuscaMangá Logo" width="160" />

# BuscaMangá Extension

**Repositório Comunitário de Extensões em Português (PT-BR) para Paperback v0.9+**

Coleção otimizada de fontes para leitura de mangás, manhwas, manhuas e quadrinhos nacionais diretamente no aplicativo Paperback.

[![Paperback v0.9+](https://img.shields.io/badge/Paperback-v0.9+-F97316?style=for-the-badge&logo=apple&logoColor=white)](https://paperback.moe/)
[![Fontes Disponíveis](https://img.shields.io/badge/Fontes-11%20Dispon%C3%ADveis-10B981?style=for-the-badge&logo=safari&logoColor=white)](#-fontes-disponíveis)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Ativo-success?style=for-the-badge&logo=github)](https://matheusparnaiba.github.io/buscamanga-extension/)

<br />

[📲 Adicionar ao Paperback](paperback://addRepo?displayName=BuscaManga&url=https%3A%2F%2Fmatheusparnaiba.github.io%2Fbuscamanga-extension%2F0.9%2Fstable%2F) • [🌐 Catálogo Web](https://matheusparnaiba.github.io/buscamanga-extension/0.9/stable/) • [🏠 Página do Repositório](https://matheusparnaiba.github.io/buscamanga-extension/)

</div>

---

## 📌 Visão Geral

O **BuscaMangá Extension** é um repositório desenvolvido para suprir a demanda da comunidade brasileira de leitores de mangá no **[Paperback](https://paperback.moe/)** (iOS / iPadOS). O ecossistema reúne as principais fontes e scans do país, trazendo alta fidelidade visual, metadados enriquecidos, páginas em alta definição e mecanismos nativos para contornar desafios de rede (Cloudflare / WAF).

> 💡 **Compatibilidade:** Desenvolvido exclusivamente para o **Paperback v0.9+** utilizando `@paperback/toolchain` e `@paperback/types`.

---

## 📦 Fontes Disponíveis

Todas as 11 extensões estão ativas e sincronizadas no GitHub Pages:

|                                         Ícone                                          | Nome                |  Versão  | Site Oficial                                         | Categoria / Recurso                     |  Status  |
| :------------------------------------------------------------------------------------: | :------------------ | :------: | :--------------------------------------------------- | :-------------------------------------- | :------: |
|    <img src="src/MangaOnline/icon.png" width="28" height="28" alt="Manga Online" />    | **Manga Online**    | `1.0.17` | [mangaonline.love](https://mangaonline.love)         | Mangás & Manhwas                        | 🟢 Ativo |
| <img src="src/MangaLivreBlog/icon.png" width="28" height="28" alt="MangaLivre Blog" /> | **MangaLivre Blog** | `1.0.10` | [mangalivre.blog](https://mangalivre.blog)           | Mangás Diversos                         | 🟢 Ativo |
|      <img src="src/Hipertoon/icon.png" width="28" height="28" alt="Hipertoon" />       | **Hipertoon**       | `1.0.16` | [hipertoon.com](https://hipertoon.com)               | Manhwas • `Bypass Cloudflare` 🛡️        | 🟢 Ativo |
|  <img src="src/MangasBrasuka/icon.png" width="28" height="28" alt="Mangás Brasuka" />  | **Mangás Brasuka**  | `1.0.16` | [mangasbrasuka.com.br](https://mangasbrasuka.com.br) | Mangás & Scans • `Bypass Cloudflare` 🛡️ | 🟢 Ativo |
|       <img src="src/MangaNYX/icon.png" width="28" height="28" alt="MangaNYX" />        | **MangaNYX**        | `1.0.12` | [manganyx.com](https://manganyx.com)                 | Catálogo Geral • `Bypass Cloudflare` 🛡️ | 🟢 Ativo |
|   <img src="src/MangaLivreTo/icon.png" width="28" height="28" alt="MangaLivre To" />   | **MangaLivre To**   | `1.0.1`  | [mangalivre.to](https://mangalivre.to)               | Mangás Populares                        | 🟢 Ativo |
|      <img src="src/Manhastro/icon.png" width="28" height="28" alt="Manhastro" />       | **Manhastro**       | `1.0.0`  | [manhastro.net](https://manhastro.net)               | Manhwas & Ação                          | 🟢 Ativo |
|   <img src="src/LeituraManga/icon.png" width="28" height="28" alt="Leitura Manga" />   | **Leitura Manga**   | `1.0.0`  | [leituramanga.net](https://leituramanga.net)         | Mangás & Manhuas                        | 🟢 Ativo |
|   <img src="src/NebulosaScan/icon.png" width="28" height="28" alt="Nebulosa Scan" />   | **Nebulosa Scan**   | `1.0.0`  | [nebulosascan.com](https://nebulosascan.com)         | Scans Exclusivas                        | 🟢 Ativo |
|        <img src="src/Fliptru/icon.png" width="28" height="28" alt="Fliptru" />         | **Fliptru**         | `1.0.0`  | [fliptru.com.br](https://fliptru.com.br)             | Quadrinhos Nacionais Independentes      | 🟢 Ativo |
|          <img src="src/HQNow/icon.png" width="28" height="28" alt="HQ Now" />          | **HQ Now**          | `1.0.0`  | [hq-now.com](https://www.hq-now.com)                 | Quadrinhos Ocidentais & HQs             | 🟢 Ativo |

> ℹ️ _Sites protegidos por Cloudflare utilizam rotinas de bypass compatíveis com o ambiente de execução do Paperback._

---

## 🚀 Como Instalar no Paperback

### Método 1: Adição Rápida (1 Clique)

Se você estiver visualizando esta página pelo Safari no seu dispositivo iOS / iPadOS com o Paperback instalado:

- Toque no link direto: **[Adicionar Repositório BuscaMangá ao Paperback](paperback://addRepo?displayName=BuscaManga&url=https%3A%2F%2Fmatheusparnaiba.github.io%2Fbuscamanga-extension%2F0.9%2Fstable%2F)**

### Método 2: Instalação Manual

1. Copie o URL estável do repositório:
   ```text
   https://matheusparnaiba.github.io/buscamanga-extension/0.9/stable/
   ```
2. Abra o aplicativo **Paperback**.
3. Navegue até a aba **Settings** (Configurações) > **External Repositories** (Repositórios Externos).
4. Toque no ícone **`+`** no canto superior e cole a URL copiada.
5. Confirme e acesse a aba **Extensions** (Extensões) para instalar as fontes de sua preferência.

---

## ✨ Recursos e Destaques

- 🛡️ **Bypass Nativo de Proteções:** Fontes que empregam proteções WAF e Cloudflare contam com interceptadores configurados para transmissão contínua de páginas e miniaturas sem erros de bloqueio.
- 🔍 **Busca Completa & Filtros:** Localize qualquer mangá ou gênero diretamente pela busca universal do leitor.
- 🖼️ **Seções de Destaque:** Carrosséis na tela inicial organizados por lançamentos recentes, mais populares e atualizações do dia.
- 📖 **Leitura Fluida:** Extração precisa de capítulos e imagens em alta resolução, com referers e cabeçalhos corretos para evitar quebras de CDN.
- 🇧🇷 **Foco Total em PT-BR:** Todas as extensões catalogadas fornecem obras traduzidas para o português do Brasil.

---

## 💻 Desenvolvimento Local

Este projeto utiliza **TypeScript**, **Node.js** e a CLI oficial do Paperback.

### Pré-requisitos

- [Node.js](https://nodejs.org/) v20+
- Gerenciador de pacotes `npm`

### Instalação & Comandos

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/matheusparnaiba/buscamanga-extension.git
   cd buscamanga-extension
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Verificação de Conformidade (TypeScript, Lint e Formatação):**

   ```bash
   npm run conformance
   ```

4. **Compilar os Bundles de Produção:**

   ```bash
   npm run bundle
   ```

   _Os arquivos compilados são gerados na pasta `./bundles`._

5. **Servidor Local de Testes (Dev Server):**
   ```bash
   npm run dev
   ```

---

## 📁 Estrutura do Repositório

```text
buscamanga-extension/
├── .github/workflows/    # Pipelines de CI/CD para validação e deploy no Pages
├── assets/               # Identidade visual, logotipos e ícones das fontes
├── bundles/              # Pacotes compilados das extensões e versioning.json
├── src/                  # Código-fonte TypeScript de cada extensão
│   ├── Fliptru/
│   ├── Hipertoon/
│   ├── HQNow/
│   ├── LeituraManga/
│   ├── MangaLivreBlog/
│   ├── MangaLivreTo/
│   ├── MangaNYX/
│   ├── MangaOnline/
│   ├── MangasBrasuka/
│   ├── Manhastro/
│   └── NebulosaScan/
├── root-index.html       # Landing page do repositório no GitHub Pages
├── template.html         # Template do catálogo web dinâmico (0.9/stable)
└── README.md             # Documentação oficial do projeto
```

---

## 📄 Licença e Aviso Legal

- **Aviso Legal:** Este projeto é open-source e tem fins estritamente educacionais e de interoperabilidade. O repositório e suas extensões não hospedam, armazenam ou redistribuem nenhum conteúdo protegido por direitos autorais; apenas conectam o aplicativo Paperback a websites públicos já disponíveis na internet.
- **Licença:** Distribuído sob a licença [GNU General Public License v3.0](LICENSE).
