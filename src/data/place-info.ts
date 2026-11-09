/* The story of each Esperança scene's real place, shown by the "i" button in the HUD (src/ui/place-info.ts).
   Every fact here comes from the cited sources (researched list: local history blog História Esperancense,
   Revivendo Esperança, the Prefeitura, g1, Wikipedia). Nothing is invented: where no reliable history of a
   street name or shop was found, the entry says so and only describes what the scene shows.
   Pure data + helpers, no DOM, so it is unit-tested (test/place-info.test.ts). */

export interface PlaceSource { url: string; label: string }
export interface PlaceInfo {
  title: string;
  /** 2–3 short paragraphs */
  paragraphs: string[];
  /** curiosities, when the sources have any (may be empty) */
  curiosities: string[];
  sources: PlaceSource[];
  /** true when the sources are thin: the text only describes the scene and the city */
  thin?: boolean;
}

const PREFEITURA: PlaceSource = { url: 'https://esperanca.pb.gov.br/public/a-cidade/historia', label: 'Prefeitura de Esperança — História da cidade' };
const CRONOLOGIA: PlaceSource = { url: 'https://historiaesperancense.blogspot.com/2014/05/cronologia-paroquia-de-esperanca.html', label: 'História Esperancense — Cronologia da Paróquia de Esperança' };
const RUA_MANOEL: PlaceSource = { url: 'https://historiaesperancense.blogspot.com/2023/04/rua-manoel-rodrigues-de-oliveira.html', label: 'História Esperancense — Rua Manoel Rodrigues de Oliveira' };

export const PLACE_INFO: Readonly<Record<string, PlaceInfo>> = {
  'praca-matriz': {
    title: 'Igreja Matriz de Nossa Senhora do Bom Conselho',
    paragraphs: [
      'No local da atual matriz, Frei Venâncio fundou em 1860 uma capela sob a invocação de Nossa Senhora do Bom Conselho, concluída em 1862, quando Esperança ainda se chamava Banabuyé.',
      'A paróquia foi criada em 20/05/1908 pelo bispo Dom Adauto Aurélio de Miranda Henriques, desmembrada de Alagoa Nova. O primeiro pároco, Pe. Francisco Gonçalves de Almeida, assumiu em 08/06/1908.',
      'A fachada foi reformada sob Mons. João Honorato: as obras começaram em 08/11/1939, ganharam uma torre central de cerca de 14 m e a reforma foi inaugurada em 14/04/1940. A festa religiosa da padroeira é em 26 de abril, e a tradição local também a celebra em janeiro.',
    ],
    curiosities: [
      'A arrecadação para o relógio da igreja começou em 28/06/1931, com o Coronel Elísio Sobreira.',
      'A antiga capela (foto de 1935) tinha três torres; a reforma deixou só a central.',
    ],
    sources: [
      { url: 'https://historiaesperancense.blogspot.com/2010/01/a-capela-que-deu-origem-matriz.html', label: 'História Esperancense — A capela que deu origem à Matriz' },
      CRONOLOGIA,
      { url: 'https://historiaesperancense.blogspot.com/2011/02/as-reformas-da-igreja-matriz.html', label: 'História Esperancense — As reformas da Igreja Matriz' },
      { url: 'https://historiaesperancense.blogspot.com/2009/12/nossa-senhora-do-bom-conselho.html', label: 'História Esperancense — Nossa Senhora do Bom Conselho' },
      PREFEITURA,
    ],
  },

  capelinha: {
    title: 'Capelinha de Nossa Senhora do Perpétuo Socorro (Capelinha das Pedras)',
    paragraphs: [
      'A capelinha fica sobre o Lajedo do Araçá (do tupi: lugar onde primeiro se avista o sol). Foi inaugurada em 01/01/1925 por iniciativa de Esther Fernandes de Oliveira, a "Dona Niná", e do marido Manoel Rodrigues de Oliveira, primeiro prefeito, em agradecimento a graças alcançadas. Teve a bênção do Pe. José Borges e a aprovação de Dom Adauto.',
      'Mede cerca de 3 m de largura por 10 m de altura e cabem poucas pessoas dentro. Foi restaurada em 2008 pelo monge beneditino Adriano de Lima.',
      'É Patrimônio Histórico e Cultural do Estado da Paraíba (Lei 11.571/2019) e do município (Lei 406/2019).',
    ],
    curiosities: [
      'A tradição local liga a promessa a um surto de cólera na região.',
      'Em maio de 1925 o governador João Suassuna visitou a capelinha (revista Era Nova).',
    ],
    sources: [
      { url: 'https://g1.globo.com/pb/paraiba/noticia/2019/12/11/capela-em-esperanca-pb-se-torna-patrimonio-historico-e-cultural-da-paraiba.ghtml', label: 'g1 PB — Capela em Esperança se torna patrimônio histórico e cultural da Paraíba' },
      { url: 'https://historiaesperancense.blogspot.com/2025/01/centenario-da-capelinha-do-perpetuo.html', label: 'História Esperancense — Centenário da Capelinha do Perpétuo Socorro' },
      { url: 'https://historiaesperancense.blogspot.com/2011/09/capelinha-do-perpetuo-socorro.html', label: 'História Esperancense — Capelinha do Perpétuo Socorro' },
      CRONOLOGIA,
    ],
  },

  'praca-cultura': {
    title: 'Praça da Cultura Deputado Francisco Souto Neto',
    paragraphs: [
      'Até o fim dos anos 1970 era um espaço vazio em frente ao Ginásio Diocesano. A praça foi construída por iniciativa do prefeito Luiz Martins de Oliveira, na virada dos anos 1970 para 1980.',
      'O nome homenageia o deputado esperancense Francisco Souto Neto, o "Chico Souto" (28/04/1919–07/08/1996), eleito em 1958 pelo PSD e reeleito em 1962 e 1966.',
      'É ponto de encontro de estudantes, junto à biblioteca e às escolas. Reformas posteriores mudaram o desenho da praça, incluindo o letreiro "Eu ♥ Esperança".',
    ],
    curiosities: [
      'O nome "praça da cultura" vem da proximidade com a biblioteca e com o CAOBE/escola.',
      'Chico Souto foi cassado pela ditadura militar cerca de três anos depois da eleição de 1966.',
    ],
    sources: [
      { url: 'http://revivendoesperancapb.blogspot.com/2012/09/a-praca-da-cultura-vida-ao-espaco-que.html', label: 'Revivendo Esperança — A Praça da Cultura' },
      { url: 'https://historiaesperancense.blogspot.com/2020/09/antes-que-me-esqueca-praca-da-cultura.html', label: 'História Esperancense — Antes que me esqueça: Praça da Cultura' },
      { url: 'https://historiaesperancense.blogspot.com/2023/08/familia-souto.html', label: 'História Esperancense — Família Souto' },
      { url: 'http://revivendoesperancapb.blogspot.com/2012/09/a-avenida-manoel-rodrigues-vista-em.html', label: 'Revivendo Esperança — A Avenida Manoel Rodrigues' },
    ],
  },

  'rua-manoel-rodrigues': {
    title: 'Avenida Manoel Rodrigues de Oliveira',
    paragraphs: [
      'É a artéria principal do centro. O povoamento da cidade está ligado à feira de Banabuyé e à capela do Bom Conselho.',
      'Antes se chamava Avenida Senador Epitácio (Pessoa). A Lei municipal nº 48, de 13/03/1950 (prefeito Júlio Ribeiro da Silva), deu-lhe o nome de Manoel Rodrigues de Oliveira, primeiro prefeito (1925–1929) e comerciante da Loja Ideal (1911–1950), falecido em 14/02/1950.',
      'A Lei nº 101, de 15/10/1963, firmou a forma "avenida".',
    ],
    curiosities: [
      'As primeiras casas de taipa dos colonos portugueses ficavam nesta rua (Prefeitura).',
      'Na década de 1960 o prefeito Arlindo Delgado arborizou a avenida com um canteiro central, depois removido.',
    ],
    sources: [
      RUA_MANOEL,
      { url: 'https://historiaesperancense.blogspot.com/2011/11/lei-4850-denomina-ruas-de-esperanca.html', label: 'História Esperancense — Lei 48/50 denomina ruas de Esperança' },
      { url: 'https://historiaesperancense.blogspot.com/2010/03/manuel-rodrigues-de-oliveira.html', label: 'História Esperancense — Manuel Rodrigues de Oliveira' },
      PREFEITURA,
    ],
  },

  'rua-comercio': {
    title: 'Rua do Comércio',
    paragraphs: [
      'Uma rua comercial típica do centro de Esperança: casario, lojas, farmácia, padaria e bar, como na cena.',
      'O comércio da cidade cresceu a partir da feira de Banabuyé (por volta de 1860), que deu origem à aglomeração urbana. Ao longo do tempo a feira mudou de endereço, da artéria principal para outras ruas e para o entorno do Mercado Público.',
      'Não encontramos uma história documentada própria desta rua além do seu papel no comércio da cidade.',
    ],
    curiosities: ['A feira semanal foi o embrião econômico da povoação.'],
    sources: [
      { url: 'https://historiaesperancense.blogspot.com/2015/07/a-feira-de-esperanca.html', label: 'História Esperancense — A feira de Esperança' },
      { url: 'https://historiaesperancense.blogspot.com/2021/02/evoluindo-de-uma-feira.html', label: 'História Esperancense — Evoluindo de uma feira' },
      PREFEITURA,
    ],
  },

  'campo-rodoviaria': {
    title: 'Campo da Rodoviária',
    paragraphs: [
      'Um terreno de cerca de 12.712 m² foi desapropriado no governo estadual de Wilson Leite Braga (imissão de posse em abril de 1986; posse definitiva em 01/04/2004) para um terminal rodoviário que nunca foi construído, entre mudança de governo, litígio e lobby.',
      'O espaço passou a ser usado como campo de futebol amador, sobretudo nos fins de semana, e depois foi urbanizado com área de caminhada. A Prefeitura noticiou obras de revitalização, como o gramado.',
      'No uso local também é chamado de "Campo do América".',
    ],
    curiosities: [
      'As agências São José e Passos teriam guichês no terminal planejado.',
      'O nome "rodoviária" ficou no campo mesmo sem terminal.',
    ],
    sources: [
      { url: 'https://historiaesperancense.blogspot.com/2016/05/a-rodoviaria-que-virou-campo.html', label: 'História Esperancense — A rodoviária que virou campo' },
      { url: 'https://www.esperanca.pb.gov.br/noticia/mais-um-dia-de-avancos-nas-obras-do-campo-da-rodoviaria', label: 'Prefeitura de Esperança — Avanços nas obras do Campo da Rodoviária' },
      { url: 'http://revivendoesperancapb.blogspot.com/2012/09/fatos-e-fotos-que-fizeram-historia-de_27.html', label: 'Revivendo Esperança — Fatos e fotos (Campo do América como lazer de domingo)' },
    ],
  },

  'armazem-paraiba': {
    title: 'Armazém Paraíba',
    paragraphs: [
      'Rede nordestina de lojas de departamento. A marca foi fundada em 19/07/1958 em Bacabal (MA) pelos irmãos paraibanos Valdecy Claudino e João Claudino Fernandes; o nome homenageia a Paraíba.',
      'A rede se expandiu por vários estados. Na Paraíba, ligada ao grupo N. Claudino & Cia. (sede em João Pessoa), opera lojas de móveis e eletrodomésticos.',
      'A loja da cena é uma filial da marca em Esperança; não encontramos a data de abertura desta filial.',
    ],
    curiosities: [
      'Slogan conhecido: "Sucesso em qualquer lugar".',
      'A família Claudino é originária da Paraíba.',
    ],
    sources: [
      { url: 'https://pt.wikipedia.org/wiki/Armaz%C3%A9m_Para%C3%ADba', label: 'Wikipédia — Armazém Paraíba' },
      { url: 'https://g1.globo.com/pi/piaui/especial-publicitario/armazem-paraiba/noticia/2023/07/19/armazem-paraiba-65-anos.ghtml', label: 'g1 PI (especial publicitário) — Armazém Paraíba 65 anos' },
      { url: 'http://armazemparaiba.socic.com.br/historia', label: 'Armazém Paraíba — História' },
    ],
  },

  'centro-teatro': {
    title: 'Centro · Casa de Amigos',
    paragraphs: [
      'Um trecho comercial do centro de Esperança, no eixo da avenida principal (Manoel Rodrigues / PB-121), com fachadas de lojas como Decorama, Casa de Amigos e óticas, vitrines e pedestres.',
      'Não encontramos história documentada da loja Casa de Amigos; a cena mostra o centro comercial da cidade como ele é.',
    ],
    curiosities: ['O Ginásio Diocesano, concluído em 1953, fica nas imediações do eixo escolar do centro (não é o prédio da cena).'],
    sources: [
      RUA_MANOEL,
      PREFEITURA,
      { url: 'https://historiaesperancense.blogspot.com/2015/10/ginasio-diocesano-algumas-notas.html', label: 'História Esperancense — Ginásio Diocesano: algumas notas' },
    ],
    thin: true,
  },

  'rua-faustino': {
    title: 'Rua Faustino Porto',
    paragraphs: [
      'Uma rua residencial e comercial de Esperança vista em perspectiva, com casas coloridas e comércio de bolos, como na cena.',
      'Não encontramos uma história documentada do nome da rua nem da pessoa homenageada.',
    ],
    curiosities: ['Esperança foi elevada a município pela lei estadual 624, de 01/12/1925.'],
    sources: [PREFEITURA],
    thin: true,
  },

  'rua-jose-bezerra': {
    title: 'Rua José Bezerra da Costa',
    paragraphs: [
      'Uma rua com canteiro central arborizado, comércio e trânsito local; na cena passa a van da Super Esperança.',
      'Não encontramos uma história documentada da pessoa homenageada.',
    ],
    curiosities: ['Esperança foi elevada a município pela lei estadual 624, de 01/12/1925.'],
    sources: [PREFEITURA],
    thin: true,
  },
};

/** The place story for a scene, only for Esperança scenes; null elsewhere (the "i" button is not shown). */
export function placeInfoFor(city: string, sceneId: string): PlaceInfo | null {
  if (city !== 'esperanca') return null;
  return Object.hasOwn(PLACE_INFO, sceneId) ? PLACE_INFO[sceneId] : null;
}
