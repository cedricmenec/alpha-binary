# Backlog AlphaBinary CLI

Ordre d'exécution : AB-001 à AB-008. Chaque fichier AB-NNN sert d'entrée au workflow ASF V1 existant et génère son propre changement OpenSpec `openspec/changes/ab-nnn/`.

État initial : toutes les tâches sont À faire, priorité P1. Les dépendances sont linéaires pour rendre l'ordre explicite et éviter les cycles. Pas d'estimation, date cible ou assignation.

## Prérequis ASF

AB-001 est un bootstrap Greenfield non payant. Le workflow ASF installé vérifie `openspec/config.yaml`, le fichier de tâche, `package-lock.json` et `npm run check` avant de démarrer une phase. Ces éléments doivent donc être établis avant tout premier run ASF. AB-001 ne donne pas l'autorisation de lancer OpenCode/OpenRouter. Aucun run LLM payant n'est autorisé par cette backlog.

## Références

- [Projet AlphaBinary dans Notion](https://app.notion.com/p/40a12ac916368141ad22f03f2b3e10e7)
- [Cadrage et spécifications](https://app.notion.com/p/40a12ac91636817da50fd916e70d1c68)
- [Backlog Notion](https://app.notion.com/p/40a12ac9163681bc98cbed76e6244982)
- [ASF V1](https://app.notion.com/p/40812ac916368119bb0fe6dc311dd92e)
- [Contrat ASF du dépôt](../../.asf/agentkit/runtime/phase.sh)
