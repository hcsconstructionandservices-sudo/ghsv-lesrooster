# Hondenschool Lesrooster Web-App

Deze webpagina toont het actuele lesrooster, instructeurs en een live klok. Ontworpen voor gebruik op een Samsung TV.

## Functies
- Live klok
- Huidige les op basis van tijd
- Komende lessen
- Instructeur(s) met profielfoto
- Rooster uit los JSON-bestand
- Automatische refresh van data
- Promotiepagina met doorlopende afbeeldingen, video's en weblinks

## Bestanden
- index.html
- style.css
- script.js
- rooster.json
- img/ (profielfoto's)
- promotie.html
- promotie.js
- promotie-media.json
- promotie-beheer.html
- promotie-beheer.js

## Promotie JSON-formaat
De promotiepagina leest `promotie-media.json` met dit formaat:

```json
{
	"settings": {
		"imageDurationMs": 9000,
		"webDurationMs": 22000,
		"videoFallbackDurationMs": 30000
	},
	"items": [
		{ "type": "image", "file": "mijn-foto.jpg" },
		{ "type": "video", "file": "mijn-video.mp4" },
		{ "type": "web", "src": "https://voorbeeld.nl" }
	]
}
```

- Gebruik `file` voor bestanden in `img/`.
- Gebruik `src` voor een volledig pad of webadres.
- Ondersteunde types: `image`, `video`, `web`.
- Optioneel per item: `durationMs`.

## Promotie Beheerpagina
- Open `promotie-beheer.html`.
- Voeg items toe met formulier (type + file of src).
- Orden of verwijder items in de lijst.
- Klik op `Opslaan naar JSON` en daarna op `Download JSON`.
- Plaats het gedownloade bestand als `promotie-media.json` in de root van dit project.

## Gebruik
Open `index.html` in de webbrowser van de Samsung TV. Plaats profielfoto's in de map `img/` en vul `rooster.json` met het lesrooster. Voor de promotiepagina open je `promotie.html` en beheer je de playlist via `promotie-media.json`.
