# zoedewitte.com

**Dino Rêveur** : un petit jeu de course proposé par Zoé Dewitte.

Un dinosaure court, saute par-dessus les cactus, se baisse sous les ptérodactyles
et ramasse des étoiles, pendant que le ciel passe du jour à la nuit.

## Commandes

| Action        | Clavier              | Tactile                    |
| ------------- | -------------------- | -------------------------- |
| Sauter        | Espace / ↑ (maintenir = plus haut) | Toucher l'écran |
| Se baisser    | ↓                    | Glisser vers le bas        |
| Pause         | P / Échap            | Bouton pause               |

## Fonctionnalités

- Défi du jour (identique pour tout le monde, avec série de jours)
- Tableau d'honneur des 5 meilleurs scores
- 12 badges à débloquer
- 6 couleurs de dino débloquées selon le record
- Statistiques, partage du score, son, plein écran, mode sombre

Toutes les données restent dans le `localStorage` du navigateur du joueur :
aucun serveur, aucune base de données, aucun traceur.

## Structure

```
index.html            page principale
assets/css/style.css  styles
assets/js/game.js     moteur du jeu et interface
assets/img/           favicon
CNAME                 domaine personnalisé (géré par GitHub Pages)
.nojekyll             désactive Jekyll sur GitHub Pages
```

## Lancer en local

Aucune installation nécessaire :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déploiement

Site statique publié par GitHub Pages depuis la branche `main`.
