# JavaScript Modules

## Structuur

```
js/
├── utils.js        # Gedeelde utility functies
├── peopleData.js   # Data laag voor people.json
├── components.js   # Herbruikbare DOM rendering functies
├── main.js         # Entry point voor landing page
└── people.js       # Entry point voor people pagina
```

## Modules

### utils.js
Algemene helper functies die op meerdere pagina's gebruikt worden.

| Functie | Beschrijving |
|---------|--------------|
| `setFooterYear(id)` | Zet het huidige jaar in de footer |
| `getQueryParam(key)` | Haalt een URL query parameter op |
| `toggleViews(show, hide)` | Wisselt display tussen twee elementen |

### peopleData.js
Centrale data laag voor alle people-gerelateerde data operaties.

| Functie | Beschrijving |
|---------|--------------|
| `fetchPeopleData()` | Haalt people.json op (met caching) |
| `getPeopleCount()` | Returnt aantal members |
| `getAllMembers()` | Returnt alle members |
| `getMemberById(id)` | Vindt een specifieke member |

### components.js
Herbruikbare functies voor het renderen van DOM elementen.

| Functie | Beschrijving |
|---------|--------------|
| `createPersonListItem(member)` | Maakt een `<li>` voor de people lijst |
| `createExternalLink(link)` | Maakt een externe link `<li>` |
| `renderList(container, items, fn)` | Generieke list renderer |

### main.js
Entry point voor `index.html`. Initialiseert:
- Footer jaar
- People count in navigatie link

### people.js
Entry point voor `people/index.html`. Handelt:
- Lijst weergave (`/people`)
- Detail weergave (`/people?id=...`)

## Waarom deze opsplitsing?

### Probleem: Code duplicatie
**Voorheen:** Dezelfde code stond in beide HTML bestanden:
- Footer jaar instellen (2x)
- Fetch naar people.json (2x)
- DOM element creatie patronen (3x+)

### Oplossing: Single source of truth
**Nu:** Elke functionaliteit bestaat op één plek:
- Wijziging in data URL? Alleen `peopleData.js` aanpassen
- Nieuwe list item styling? Alleen `components.js` aanpassen
- Footer formaat wijzigen? Alleen `utils.js` aanpassen

### Voordelen
1. **Minder code** - Van ~75 inline regels naar ~20 regels per module
2. **Caching** - Data wordt maar één keer gefetcht
3. **Testbaar** - Functies kunnen individueel getest worden
4. **Uitbreidbaar** - Nieuwe pagina's kunnen dezelfde modules importeren
5. **Leesbaar** - Elke file heeft één duidelijke verantwoordelijkheid
