
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
  stimulus: "<p>Appuyez sur n’importe quelle touche pour activer l’audio.</p>"
};

const instructions_es = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p>Instructions du ABX...</p>"
};

const end_screen = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p>Merci pour votre participation !</p>"
};

const resumeAudio = () => {
  try {
    const ctx = jsPsych.pluginAPI.audioContext();
    if (ctx && ctx.state === "suspended") ctx.resume();
  } catch(e) {}
};

function ABX_trial(trial_number, A, B) {
  const X_is_A = Math.random() < 0.5;
  const X = X_is_A ? A : B;
  const correct = X_is_A ? "f" : "j";
  const isi = 600;

  const makeAudioTrial = (filename) => ({
    type: jsPsychAudioKeyboardResponse,
    stimulus: `audio/${filename}`,
    choices: "NO_KEYS",
    trial_ends_after_audio: true,
    post_trial_gap: isi + 50,
    on_start: () => resumeAudio(),
  });

  const makeXTrial = () => ({
    type: jsPsychAudioKeyboardResponse,
    stimulus: `audio/${X}`,
    choices: ["f","j"],
    trial_ends_after_audio: true,
    trial_duration: 5000,
    post_trial_gap: isi + 50,
    prompt: "<p>F = A &nbsp;&nbsp; J = B</p>",
    on_start: () => resumeAudio(),
    on_finish: data => {
      if (data.response === null) {
        data.correctness = 0;
        data.skipped = true;
      } else {
        data.correctness = data.response === correct ? 1 : 0;
      }
      data.rt_start = data.time_elapsed - data.rt;
      data.rt_end = data.time_elapsed;
    }
  });

  return [
    makeAudioTrial(A),
    makeAudioTrial(B),
    makeXTrial()
  ];
}

const timeline = [participant_info, unlock_audio, instructions_es];

fetch("stimuli.csv").then(r => r.text()).then(text => {
  let rows = text.trim().split("\n").slice(1).map(l => {
    const [A,B] = l.split(",");
    return { A: A.trim(), B: B.trim() };
  });

  rows = jsPsych.randomization.shuffle(rows);

  const nBlocks = 5;
  const blockSize = Math.ceil(rows.length / nBlocks);

  for(let i=0;i<nBlocks;i++){
    const blockRows = rows.slice(i*blockSize,(i+1)*blockSize);

    const audioFiles = [...new Set(blockRows.flatMap(r => [`audio/${r.A}`,`audio/${r.B}`]))];
    timeline.push({
      type: jsPsychPreload,
      audio: audioFiles,
      show_progress_bar:true,
      message:`<p>Chargement du bloc ${i+1} / ${nBlocks}…</p>`
    });

    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus:`<p>Bloc ${i+1} / ${nBlocks}.</p>
                <p>Répondez le plus vite possible. Si vous ne répondez pas, le trial suivant apparaîtra automatiquement.</p>
                <p><em>Appuyez sur une touche pour commencer.</em></p>`
    });

    let trial_n = i*blockSize + 1;
    blockRows.forEach(row => {
      timeline.push(...ABX_trial(trial_n,row.A,row.B));
      trial_n++;
    });

    if(i<nBlocks-1){
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus:`<p>Fin du bloc ${i+1} / ${nBlocks}.</p>
                  <p>Vous pouvez faire une courte pause.</p>
                  <p><em>Appuyez sur une touche pour continuer.</em></p>`
      });
    }
  }

  timeline.push(end_screen);
  jsPsych.run(timeline);
}).catch(e => console.error("Erreur fetch stimuli.csv:",e));
