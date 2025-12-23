
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_14EQfLDzNXf6cWppZvFoo6SfpEpRAZCH9SNx31degMFvUB3ZJqiJSFAJiCsBpr_g/exec";


const jsPsych = initJsPsych({
  on_finish: () => {
    const csv = jsPsych.data.get().csv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ABX_results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

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
      <p style="text-align:center; font-style:italic;">tocar cualquiera tecla del teclado para empezar</p>
    </div>
  `
};

// const instructions = {
//   type: jsPsychHtmlKeyboardResponse,
//   stimulus: `
//     <div style="max-width:700px; margin:auto; font-family:Arial, sans-serif; line-height:1.6;">
//       <h2 style="text-align:center; color:#2c3e50;">Instructions de l'expérience ABX</h2>
//       <p>Vous allez entendre trois sons à chaque essai :</p>
//       <ol>
//         <li><strong>A</strong> — premier son</li>
//         <li><strong>B</strong> — deuxième son</li>
//         <li><strong>X</strong> — à comparer avec A ou B</li>
//       </ol>
//       <p>Tâche :</p>
//       <ul>
//         <li>Appuyez sur <strong>F</strong> si X = A</li>
//         <li>Appuyez sur <strong>J</strong> si X = B</li>
//       </ul>
//       <p><strong>Important :</strong> utilisez un casque et soyez dans un endroit calme.</p>
//       <p style="text-align:center; font-style:italic;">Appuyez sur n’importe quelle touche du clavier pour commencer.</p>
//     </div>
//   `
// };

const end_screen = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<h2>Merci pour votre participation !</h2>"
};

const resumeAudio = () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  if (ctx && ctx.state === "suspended") {
    return ctx.resume();
  }
};

function ABX_trial(trial_number, A, B) {

  const X_is_A = Math.random() < 0.5;
  const X = X_is_A ? A : B;
  const correct = X_is_A ? "f" : "j";

  const isi = 600;  // A/B/X spacing

  const makeAudioTrial = (filename, choices="NO_KEYS", prompt=null, on_finish_cb=null) => ({
    type: jsPsychAudioKeyboardResponse,
    stimulus: `audio/${filename}`,
    choices: choices,
    trial_ends_after_audio: true,

    post_trial_gap: isi + 50, // 50 ms extra buffer

    prompt: prompt,

    on_start: () => {
      const ctx = jsPsych.pluginAPI.audioContext();
      if (ctx && ctx.state === "suspended") ctx.resume();
    },

    on_finish: data => {
      const ctx = jsPsych.pluginAPI.audioContext();
      if (ctx && ctx._buffers) {
        try { ctx._buffers.forEach(b => b=null); } catch(e) {}
      }
      if (on_finish_cb) on_finish_cb(data);
    }
  });

  return [
    makeAudioTrial(A),
    makeAudioTrial(B),
    makeAudioTrial(X, ["f","j"], "<p>F = A &nbsp;&nbsp; J = B</p>", d => {
      d.correctness = d.response === correct ? 1 : 0;
      d.rt_start = d.time_elapsed - d.rt;
      d.rt_end = d.time_elapsed;
    })
  ];
}


  return [
    makeAudioTrial(A),
    makeAudioTrial(B),
    makeAudioTrial(X, ["f","j"], "<p>F = A &nbsp;&nbsp; J = B</p>", d => {
      d.correctness = d.response === correct ? 1 : 0;
      d.rt_start = d.time_elapsed - d.rt;
      d.rt_end = d.time_elapsed;
    })
  ];
}


const timeline = [participant_info, unlock_audio, instructions_es];

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
