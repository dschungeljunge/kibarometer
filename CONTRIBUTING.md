# Wie man zu Kibarometer beiträgt

Wir freuen uns sehr, dass Sie sich für eine Mitarbeit am Kibarometer-Projekt interessieren! Jeder Beitrag ist willkommen und hilft uns, das Tool besser zu machen.

## Verhaltenskodex (Code of Conduct)

Um eine offene und freundliche Umgebung zu gewährleisten, halten wir uns an einen [Verhaltenskodex](LINK_ZU_CODE_OF_CONDUCT.md). Bitte lesen und befolgen Sie diesen in allen unseren Projektbereichen. (Hinweis: Sie können später eine `CODE_OF_CONDUCT.md`-Datei hinzufügen).

## Wie kann ich beitragen?

### 🐛 Fehler melden

Wenn Sie einen Fehler finden, erstellen Sie bitte ein **Issue** in unserem GitHub-Repository. Beschreiben Sie den Fehler so detailliert wie möglich:

-   **Was haben Sie getan?** (z.B. "Ich habe den Fragebogen ausgefüllt und auf 'Auswerten' geklickt.")
-   **Was haben Sie erwartet?** (z.B. "Ich habe erwartet, zur Auswertungsseite zu gelangen.")
-   **Was ist tatsächlich passiert?** (z.B. "Ich habe eine Fehlermeldung erhalten / die Seite ist abgestürzt.")
-   Fügen Sie, wenn möglich, Screenshots oder Konsolenausgaben hinzu.

### ✨ Neue Features vorschlagen

Haben Sie eine Idee für eine neue Funktion oder eine Verbesserung? Erstellen Sie ebenfalls ein **Issue** und verwenden Sie das "Feature Request"-Template (falls vorhanden). Beschreiben Sie Ihre Idee und warum sie für das Projekt nützlich wäre.

### 💻 Code beitragen (Pull Requests)

Wenn Sie Code beisteuern möchten, folgen Sie bitte diesen Schritten:

1.  **Forken Sie das Repository** auf GitHub.
2.  **Klonen Sie Ihren Fork** auf Ihren lokalen Rechner:
    ```bash
    git clone https://github.com/IHR-BENUTZERNAME/kibarometer.git
    ```
3.  **Erstellen Sie einen neuen Branch** für Ihre Änderungen:
    ```bash
    git checkout -b feature/mein-neues-feature
    ```
    *(Verwenden Sie sinnvolle Branch-Namen wie `fix/login-fehler` oder `feature/neues-diagramm`)*.
4.  **Nehmen Sie Ihre Änderungen vor.** Beachten Sie dabei unseren Code-Stil.
5.  **Commiten Sie Ihre Änderungen** mit einer aussagekräftigen Commit-Nachricht:
    ```bash
    git commit -m "feat: Fügt ein neues Diagramm zur Auswertungsseite hinzu"
    ```
    *(Wir bevorzugen den [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) Standard.)*
6.  **Pushen Sie Ihre Änderungen** zu Ihrem Fork:
    ```bash
    git push origin feature/mein-neues-feature
    ```
7.  **Erstellen Sie einen Pull Request** von Ihrem Branch zum `main`-Branch des Original-Repositorys. Beschreiben Sie Ihre Änderungen im Pull Request.

## Stilrichtlinien

-   **Code-Formatierung**: Wir verwenden Prettier zur automatischen Code-Formatierung. Führen Sie vor einem Commit `npm run format` aus.
-   **Linting**: Wir verwenden ESLint, um die Code-Qualität sicherzustellen. Führen Sie `npm run lint` aus, um nach Problemen zu suchen.

Vielen Dank für Ihren Beitrag! 