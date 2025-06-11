"use client";

export default function DatenschutzPage() {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Datenschutzerklärung</h1>
      
      <div className="bg-white rounded-lg shadow p-8 space-y-8">
        
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">1. Verantwortlicher</h2>
          <p className="text-gray-700 leading-relaxed">
            Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:<br />
            <strong>[Ihr Name/Institution]</strong><br />
            [Adresse]<br />
            [E-Mail]<br />
            [Telefon]
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">2. Zweck der Datenerhebung</h2>
          <p className="text-gray-700 leading-relaxed">
            Diese Umfrage wird zu wissenschaftlichen Forschungszwecken durchgeführt. 
            Ziel ist es, die <strong>Einstellungen von Lehrpersonen gegenüber Künstlicher Intelligenz</strong> zu untersuchen. 
            Die Ergebnisse werden zur Entwicklung von Bildungsstrategien und wissenschaftlichen Publikationen verwendet.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">3. Erhobene Daten</h2>
          <p className="text-gray-700 leading-relaxed mb-4">Wir erheben folgende Daten:</p>
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Demografische Angaben:</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Altersgruppe (kategorisch: z.B. "25-34")</li>
              <li>Berufserfahrung (kategorisch: z.B. "6-10 Jahre")</li>
              <li>Geschlecht (optional)</li>
              <li>Schulstufe</li>
              <li>Berufliche Rolle</li>
            </ul>
            
            <h3 className="font-semibold mb-2 mt-4">Umfrageantworten:</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Bewertungen zu KI-bezogenen Aussagen (Skala 1-5)</li>
              <li>Keine personenbezogenen Identifikationsmerkmale</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">4. Rechtsgrundlage</h2>
          <p className="text-gray-700 leading-relaxed">
            Die Datenverarbeitung erfolgt auf Grundlage von <strong>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</strong>. 
            Durch die Teilnahme an der Umfrage erklären Sie sich mit der Verarbeitung Ihrer Daten zu wissenschaftlichen Zwecken einverstanden.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">5. Anonymität und Pseudonymisierung</h2>
          <p className="text-gray-700 leading-relaxed">
            Ihre Antworten werden <strong>pseudonymisiert</strong> gespeichert. Es werden keine Namen, E-Mail-Adressen oder 
            andere direkten Identifikationsmerkmale erhoben. Eine Zuordnung zu Ihrer Person ist für die Forscher nicht möglich.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibond mb-4 text-blue-600">6. Datenspeicherung und -sicherheit</h2>
          <div className="text-gray-700 leading-relaxed space-y-3">
            <p><strong>Speicherort:</strong> Die Daten werden bei Supabase (EU-basiert) gespeichert.</p>
            <p><strong>Sicherheitsmaßnahmen:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>SSL-Verschlüsselung bei der Übertragung</li>
              <li>Verschlüsselte Datenspeicherung</li>
              <li>Zugriffsbeschränkungen (Row Level Security)</li>
              <li>Input-Validierung und Rate-Limiting</li>
            </ul>
            <p><strong>Aufbewahrungsdauer:</strong> Die Daten werden für die Dauer des Forschungsprojekts (max. 10 Jahre) gespeichert.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">7. Ihre Rechte</h2>
          <p className="text-gray-700 leading-relaxed mb-4">Sie haben folgende Rechte:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li><strong>Auskunft:</strong> Information über gespeicherte Daten (soweit technisch möglich bei Pseudonymisierung)</li>
            <li><strong>Berichtigung:</strong> Korrektur falscher Daten</li>
            <li><strong>Löschung:</strong> Entfernung Ihrer Daten</li>
            <li><strong>Widerspruch:</strong> Widerspruch gegen die Verarbeitung</li>
            <li><strong>Beschwerde:</strong> Bei der zuständigen Datenschutzbehörde</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-4">
            <strong>Wichtiger Hinweis:</strong> Aufgrund der Pseudonymisierung können wir Ihre spezifischen Daten 
            nach Abschluss der Umfrage nicht mehr identifizieren und löschen.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">8. Cookies und Tracking</h2>
          <p className="text-gray-700 leading-relaxed">
            Diese Website verwendet <strong>keine Cookies</strong> oder Tracking-Tools. 
            Es erfolgt keine Nachverfolgung Ihres Nutzerverhaltens über die Umfrage hinaus.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">9. Freiwilligkeit</h2>
          <p className="text-gray-700 leading-relaxed">
            Die Teilnahme an dieser Umfrage ist <strong>vollständig freiwillig</strong>. 
            Sie können die Umfrage jederzeit ohne Angabe von Gründen abbrechen. 
            Bereits eingegebene Daten werden dann nicht gespeichert.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">10. Kontakt</h2>
          <p className="text-gray-700 leading-relaxed">
            Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich an:<br />
            <strong>E-Mail:</strong> [datenschutz@ihre-institution.de]<br />
            <strong>Datenschutzbeauftragte/r:</strong> [Name und Kontakt]
          </p>
        </section>

        <section className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">Einverständniserklärung</h2>
          <p className="text-gray-700 leading-relaxed">
            <strong>Mit der Teilnahme an der Umfrage bestätigen Sie:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 mt-3">
            <li>Sie haben diese Datenschutzerklärung gelesen und verstanden</li>
            <li>Sie willigen in die Verarbeitung Ihrer Daten zu wissenschaftlichen Zwecken ein</li>
            <li>Sie sind über Ihre Rechte informiert</li>
            <li>Sie nehmen freiwillig teil</li>
          </ul>
        </section>

        <div className="text-center pt-6">
          <p className="text-sm text-gray-500">
            Stand: {new Date().toLocaleDateString('de-DE')}
          </p>
        </div>

      </div>
    </main>
  );
} 