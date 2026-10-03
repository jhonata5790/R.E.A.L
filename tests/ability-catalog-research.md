# Catálogo de habilidades — consulta de 02/10/2026

Fonte consultada: catálogo **Adicionar Habilidades**, coleção **Ordem Paranormal**, do [C.R.I.S.](https://crisordemparanormal.com/). A consulta usou apenas a expansão de descrições e os filtros; nenhuma habilidade foi adicionada à ficha do usuário no C.R.I.S.

As descrições no R.E.A.L são resumos próprios dos efeitos mecânicos. Consulte o livro para texto completo, regras gerais, exceções e esclarecimentos. Não foram incluídas as coleções Arquivos Confidenciais, Marcas Fragmentadas e Insurgentes, nem rituais como habilidades independentes.

## Cobertura

| Categoria | Entradas | Subdivisões |
| --- | ---: | --- |
| Combatente | 40 | 20 poderes/habilidades de classe; cinco trilhas de quatro habilidades |
| Especialista | 38 | 18 poderes/habilidades de classe; cinco trilhas de quatro habilidades |
| Ocultista | 37 | 17 poderes/habilidades de classe; cinco trilhas de quatro habilidades |
| Origens | 26 | Habilidades das origens do livro básico |
| Poderes Paranormais | 22 | Conhecimento, Energia, Morte, Sangue (cinco cada) e Varia (dois) |

Total: 163 entradas de catálogo. Poderes compartilhados, como Transcender, figuram em mais de uma classe; esse total não é uma contagem de nomes únicos. As 15 trilhas usam os marcos de NEX 10%, 40%, 65% e 99%.

O C.R.I.S. mistura oito outras habilidades à lista de origens da coleção oficial: Antes Só, Aula de Campo, Bagagem de Leitura, Destemido, Fontes Confiáveis, Fraternidade Gaudéria, Investigação Científica e Mobilidade Acrobática. Elas não foram atribuídas ao livro básico neste catálogo.

## Comportamento e limites

- Busca global no livro por nome, classe, trilha, origem, elemento e requisito; sem distinguir acentos ou maiúsculas.
- Os requisitos são informativos: não bloqueiam combinações autorizadas pelo mestre, Versatilidade ou Expansão de Conhecimento.
- Afinidade precisa ser explicitamente marcada ao registrar sua versão aprimorada. NEX 50% por si só não concede a melhoria.
- Escolhas/anotações registram armas, perícias, elementos e rituais; o catálogo não decide essas escolhas nem verifica automaticamente a ficha inteira.
- Duplicatas são impedidas inclusive quando a habilidade de origem já aparece automaticamente; Transcender, Treinamento em Perícia, Aprender Ritual e Resistir a Elemento continuam repetíveis.
- Na etapa original do catálogo, adicionar não aplicava bônus. A etapa de mecânicas acrescentou bônus permanentes explicitamente suportados, com opção de desligar e sem consumir recursos; consulte `sheet-mechanics-research.md`. Efeitos condicionais e poderes não suportados continuam manuais.
- O armazenamento usa a estrutura de ficha existente; habilidades antigas e itens são preservados. Falhas de gravação revertem a alteração em memória.

Testes: `ability-catalog.test.js` cobre estrutura e regras de registro; `character-view.test.js` cobre navegação, busca, expansão, inclusão, afinidade, reabertura, duplicatas e falha de salvamento.
