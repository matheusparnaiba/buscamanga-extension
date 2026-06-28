# BuscaMangá Extension

Bem-vindo ao repositório do **BuscaMangá Extension**, uma coleção de fontes para o aplicativo **Paperback** criada para facilitar a leitura de mangás em português.

> ⚠️ **Aviso de Compatibilidade:** Este repositório e suas extensões foram desenvolvidos e testados **exclusivamente para a versão 0.9** do aplicativo Paperback. Certifique-se de estar utilizando a versão correta do app.

## 📦 Fontes Disponíveis

Atualmente, nosso repositório conta com as seguintes fontes:

| Ícone | Nome                |  Versão  | Desenvolvedor   | Site Oficial                                         |
| :---: | ------------------- | :------: | --------------- | ---------------------------------------------------- |
|  🌟   | **Manga Online**    | `1.0.11` | matheusparnaiba | [mangaonline.blue](https://mangaonline.blue)         |
|  📖   | **Manga Livre**     | `1.0.14` | matheusparnaiba | [mangalivre.to](https://mangalivre.to)               |
|  🌸   | **Sakura Mangas**   | `1.0.5`  | matheusparnaiba | [sakuramangas.org](https://sakuramangas.org)         |
|  📓   | **MangaLivre Blog** | `1.0.3`  | matheusparnaiba | [mangalivre.blog](https://mangalivre.blog)           |
|  💫   | **Hipertoon**       | `1.0.3`  | matheusparnaiba | [hipertoon.com](https://hipertoon.com)               |
|  🇧🇷   | **Mangás Brasuka**  | `1.0.1`  | matheusparnaiba | [mangasbrasuka.com.br](https://mangasbrasuka.com.br) |

## 🚀 Como Instalar

1. Baixe o aplicativo **Paperback** em seu dispositivo móvel.
2. Acesse a [página do repositório gerada pelo GitHub Pages](https://matheusparnaiba.github.io/buscamanga-extension/0.9/stable/).
3. Clique no botão **Adicionar ao Paperback** ou adicione o link do repositório diretamente na aba de repositórios do aplicativo.
4. Vá em Extensões (Fontes) no app e instale as fontes desejadas.

## 🛠 Funcionalidades Implementadas

- **Busca Avançada:** Permite buscar os mangás diretamente na base de dados das fontes.
- **Lançamentos (Banner):** Os últimos lançamentos aparecem diretamente no topo da sua tela inicial no formato de carrossel em destaque.
- **Leitura de Capítulos:** Suporte completo para visualização de capítulos atualizados.
- **Bypass de Proteção (Cloudflare):** Interceptadores de rede já embutidos para carregar imagens e capas normalmente sem bloqueios de CDN.

## 🧑‍💻 Desenvolvimento

Este projeto foi construído usando o `paperback-cli` com `TypeScript`.
Para compilar novas fontes ou atualizar as existentes, basta rodar os comandos:

```bash
bun run tsc
bun run bundle
```

O script `.github/workflows/bundle-deploy.yaml` vai gerar e subir sua página automaticamente pro GitHub Pages!
