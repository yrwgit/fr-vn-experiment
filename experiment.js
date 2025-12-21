// ================= INITIALISATION =================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx_14EQfLDzNXf6cWppZvFoo6SfpEpRAZCH9SNx31degMFvUB3ZJqiJSFAJiCsBpr_g/exec"; // Mettre l’URL de ton Apps Script

const jsPsych = initJsPsych({
  on_finish: () => {
    // Téléchargement CSV local
    const csv = jsPsych.data.get().csv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ABX_results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Envoi des données à Google Sheets
    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsPsych.data.get().values())
    })
    .then(r => r.text())
    .then(console.log)
    .catch(err => console.error("Erreur envoi données:", err));
  }
});

// ================= PARTICIPANT INFO =================
const participant_info = {
  type: jsPsychSurveyHtmlForm,
  preamble: "<h2>Informations participant</h2>",
  html: `
    <label>Nom: <input name="name" required></label><br><br>
    <label>Email: <input name="email" type="email" required></label><br><br>
    <label>Age: <input name="age" type="number" min="1" max="120" required></label><br><br>
  `,
  button_label: "Continuer",
  on_finish: data => {
    const resp = JSON.parse(data.responses);
    jsPsych.data.addProperties({
      participant_name: resp.name,
      participant_email: resp.email,
      participant_age: resp.age,
      experiment_start_time: new Date().toISOString()
    });
  }
};

// ================= UNLOCK AUDIO =================
const unlock_audio = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p>Appuyez sur une touche pour activer l’audio.</p>"
};

// ================= INSTRUCTIONS HTML =================
const instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width:700px; margin:auto; font-family:Arial, sans-serif; line-height:1.6;">
      <h1 style="text-align:center; color:#2c3e50;">Bienvenue dans l'expérience ABX</h1>
      <p>Merci de participer à cette étude. Veuillez lire attentivement les consignes :</p>
      <ul>
        <li><strong>Casque audio :</strong> utilisez un casque pour écouter les sons.</li>
        <li><strong>Environnement :</strong> réalisez l'expérience dans un endroit calme.</li>
        <li><strong>Touches du clavier :</strong> F = A, J = B.</li>
        <li><strong>Écoute attentive :</strong> écoutez chaque son avant de répondre.</li>
        <li><strong>Stimuli :</strong> mots monosyllabiques.</li>
        <li><strong>Pauses :</strong> deux pauses automatiques sont prévues.</li>
      </ul>
      <p style="text-align:center; font-style:italic;">Cliquez sur "Commencer" lorsque vous êtes prêt(e).</p>
    </div>
  `,
  choices: ["Commencer"]
};

// ================== ABX TRIAL FUNCTION ==================
function ABX_trial(trial_number, A, B) {
  const X_is_A = Math.random() < 0.5;
  const X = X_is_A ? A : B;
  const correct = X_is_A ? "f" : "j";
  const isi = 400;

  return [
    {
      type: jsPsychAudioKeyboardResponse,
      stimulus: `audio/${A}`,
      choices: "NO_KEYS",
      trial_ends_after_audio: true,
      post_trial_gap: isi
    },
    {
      type: jsPsychAudioKeyboardResponse,
      stimulus: `audio/${B}`,
      choices: "NO_KEYS",
      trial_ends_after_audio: true,
      post_trial_gap: isi
    },
    {
      type: jsPsychAudioKeyboardResponse,
      stimulus: `audio/${X}`,
      choices: ["f","j"],
      prompt: "<p>F = A &nbsp;&nbsp; J = B</p>",
      data: { trial_number, A, B, X, correct },
      on_finish: d => {
        d.correctness = d.response === correct ? 1 : 0;
        d.rt_start = d.time_elapsed - d.rt;
        d.rt_end = d.time_elapsed;
      }
    }
  ];
}

// ================== END SCREEN ==================
const end_screen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: "<h2>Merci pour votre participation !</h2>",
  choices: ["Terminer"]
};

// ================== BUILD TIMELINE ==================
const timeline = [participant_info, unlock_audio, instructions];

fetch("stimuli.csv")
  .then(r => r.text())
  .then(text => {
    let rows = text.trim().split("\n").slice(1).map(l => {
      const [A,B] = l.split(",");
      return { A: A.trim(), B: B.trim() };
    });

    // Mélanger les trials
    rows = jsPsych.randomization.shuffle(rows);

    let trial_n = 1;
    rows.forEach((row, i) => {
      timeline.push(...ABX_trial(trial_n, row.A, row.B));
      trial_n++;

      // Ajouter pauses : après 1/3 et 2/3 des trials
      if (i === Math.floor(rows.length/3) || i === Math.floor(2*rows.length/3)) {
        timeline.push({
          type: jsPsychHtmlButtonResponse,
          stimulus: "<p>Pause ! Prenez un moment pour vous reposer.</p>",
          choices: ["Reprendre"]
        });
      }
    });

    timeline.push(end_screen);

    // ================== RUN ==================
    jsPsych.run(timeline);
  });
