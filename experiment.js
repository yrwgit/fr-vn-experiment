
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_14EQfLDzNXf6cWppZvFoo6SfpEpRAZCH9SNx31degMFvUB3ZJqiJSFAJiCsBpr_g/exec";


// Initialize jsPsych
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

// Participant info
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

// Unlock audio
const unlock_audio = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p>Appuyez sur n’importe quelle touche du clavier pour activer l’audio.</p>"
};

// Instructions (Spanish example)
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

// End screen
const end_screen = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<h2>Merci pour votre participation !</h2>"
};

// 🔴 Resume AudioContext helper (new) 🔴
const resumeAudio = () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
};

// ABX trial generator
function ABX_trial(trial_number, A, B) {
  const X_is_A = Math.random() < 0.5;
  const X = X_is_A ? A : B;
  const correct = X_is_A ? "f" : "j";
  const isi = 600; // 🔴 Increased inter-stimulus interval 🔴

  const makeAudioTrial = (filename, choices="NO_KEYS", prompt=null, on_finish_cb=null) => ({
    type: jsPsychAudioKeyboardResponse,
    stimulus: `audio/${filename}`,
    choices: choices,
    trial_ends_after_audio: true,
    post_trial_gap: isi + 50, // 🔴 extra buffer instead of async pre-play delay 🔴
    prompt: prompt,
    on_start: () => resumeAudio(), // 🔴 synchronous resume AudioContext 🔴
    on_finish: data => {
      // 🔴 safe memory cleanup 🔴
      const ctx = jsPsych.pluginAPI.audioContext();
      if (ctx && ctx._buffers) {
        try { ctx._buffers.forEach(b=>b=null); } catch(e) {}
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

// 🔴 Timeline setup with block-based preload 🔴
const timeline = [participant_info, unlock_audio, instructions_es];

fetch("stimuli.csv")
  .then(r => r.text())
  .then(text => {

    let rows = text.trim().split("\n").slice(1).map(l => {
      const [A,B] = l.split(",");
      return { A: A.trim(), B: B.trim() };
    });

    rows = jsPsych.randomization.shuffle(rows);

    // 🔴 5 blocks 🔴
    const nBlocks = 5;
    const blockSize = Math.ceil(rows.length / nBlocks);

    for (let i = 0; i < nBlocks; i++) {
      const blockRows = rows.slice(i*blockSize, (i+1)*blockSize);

      // 🔴 Block-level preload of all unique audio 🔴
      const audioFiles = [...new Set(blockRows.flatMap(r => [`audio/${r.A}`, `audio/${r.B}`]))];
      timeline.push({
        type: jsPsychPreload,
        audio: audioFiles,
        show_progress_bar: true,
        message: `<p>Chargement du bloc ${i+1} / ${nBlocks}…</p>`
      });

      // 🔴 Add ABX trials for this block 🔴
      let trial_n = i*blockSize + 1;
      blockRows.forEach(row => {
        timeline.push(...ABX_trial(trial_n, row.A, row.B));
        trial_n++;
      });

      // 🔴 Short break after each block except last 🔴
      if (i < nBlocks - 1) {
        timeline.push({
          type: jsPsychHtmlKeyboardResponse,
          stimulus: `
            <p>Fin du bloc ${i+1} / ${nBlocks}.</p>
            <p>Vous pouvez faire une courte pause.</p>
            <p><em>Appuyez sur une touche pour continuer.</em></p>
          `
        });
      }
    }

    timeline.push(end_screen);

    jsPsych.run(timeline);
  })
  .catch(e => console.error("Erreur fetch stimuli.csv:", e));
