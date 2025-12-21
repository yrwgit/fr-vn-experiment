
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_14EQfLDzNXf6cWppZvFoo6SfpEpRAZCH9SNx31degMFvUB3ZJqiJSFAJiCsBpr_g/exec";
// ⬆️⬆️⬆️ REMPLACE UNIQUEMENT CETTE LIGNE ⬆️⬆️⬆️
// (l’URL doit ABSOLUMENT se terminer par /exec)

const jsPsych = initJsPsych({
  on_finish: () => {

    /* ===== Téléchargement CSV local (sécurité) ===== */
    const csv = jsPsych.data.get().csv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ABX_results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    /* ===== Envoi automatique vers Google Sheet ===== */
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
    jsPsych.data.addProperties({
      participant_name: data.response.name,
      participant_email: data.response.email,
      participant_age: data.response.age,
      experiment_start_time: new Date().toISOString()
    });
  }
};


const unlock_audio = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p>Appuyez sur une touche pour activer l’audio.</p>"
};


let instructions = {
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
      choices: ["f", "j"],
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


const end_screen = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<h2>Merci pour votre participation !</h2>"
};

const timeline = [participant_info, unlock_audio, instructions];

fetch("stimuli.csv")
  .then(r => r.text())
  .then(text => {

    let rows = text.trim().split("\n").slice(1).map(l => {
      const [A,B] = l.split(",");
      return { A: A.trim(), B: B.trim() };
    });

    rows = jsPsych.randomization.shuffle(rows);

    let trial_n = 1;
    rows.forEach(row => {
      timeline.push(...ABX_trial(trial_n, row.A, row.B));
      trial_n++;
    });

    timeline.push(end_screen);
    jsPsych.run(timeline);
  });
