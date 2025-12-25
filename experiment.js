const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyuXp8_Zb6E_laC9eFZOoOI4YYa_qSVh0OTRDQwZghcKzntUBX6p5ye-9Nb9ZNCnyo5/exec";


const jsPsych = initJsPsych({
  on_finish: () => {

    // 1) Local CSV backup (OK to keep)
    const csv = jsPsych.data.get().csv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ABX_results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 2) Send data to Google Sheets (CORS-safe)
    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(jsPsych.data.get().values())
    });

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
  stimulus: "<p>Appuyez sur n’importe quelle touche du clavier pour activer l’audio.</p>"
};

const instructions_es = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div style="max-width:700px; margin:auto; font-family:Arial, sans-serif; line-height:1.6;">
      <h2 style="text-align:center; color:#2c3e50;">Instrucciones del experimento ABX</h2>
      <p>Vas a escuchar tres sonidos cortos A, B y X:</p>
      <ol>
        <li><strong>A</strong>: primer sonido</li>
        <li><strong>B</strong>: segundo sonido</li>
        <li><strong>X</strong>: tercero sonido (comparar con A / B)</li>
      </ol>
      <p>A y B son distintos. Tienes que elegir si X (el ultimo sonido) es el sonido A o B</p>
      <p>ejemplo: (A) "lo" (B) "la" (X) "lo" => X = A o B?</p>
      <p>Como hacer?</p>
      <ul>
        <li>Tocar <strong>F</strong> si X=A</li>
        <li>Tocar <strong>J</strong> si X=B</li>
      </ul>
      <p><strong>importante:</strong> usar un caso y estar en un lugar silencioso</p>
      <p style="text-align:center; font-style:italic;">tocar n'importe quelle touche du clavier para empezar</p>
    </div>
  `
};

const end_screen = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <h2>Merci pour votre participation !</h2>
    <p>Vous pouvez maintenant fermer cette page.</p>
  `
};

function ABX_trial(A, B) {
  const X_is_A = Math.random() < 0.5;
  const X = X_is_A ? A : B;
  const correct = X_is_A ? "f" : "j";
  const isi = 300;

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
      response_allowed_while_playing: true,
      trial_duration: 6000,
      prompt: "<p>F = A &nbsp;&nbsp; J = B</p>",
      on_finish: data => {
        if (data.response === null) {
          data.correctness = 0;
          data.skipped = true;
        } else {
          data.correctness = data.response === correct ? 1 : 0;
          data.skipped = false;
        }
      }
    }
  ];
}


const timeline = [participant_info, unlock_audio, instructions_es];

fetch("stimuli.csv")
  .then(r => r.text())
  .then(text => {
    const rows = text.trim().split("\n").slice(1).map(l => {
      const [A, B] = l.split(",");
      return { A: A.trim(), B: B.trim() };
    });

    jsPsych.randomization.shuffle(rows).forEach(row => {
      timeline.push(...ABX_trial(row.A, row.B));
    });

    timeline.push(end_screen);
    jsPsych.run(timeline);
  });
