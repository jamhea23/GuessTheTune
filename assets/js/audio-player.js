$(document).ready(function () {
  const audio = $("#songPlayer")[0];
  $("#volumeBar").val(audio.volume);
  console.log(audio.volume);
  // Play / Pause toggle
  $("#playBtn").on("click", function () {
    if (audio.paused) {
      audio.play();
      $(this).html('<i class="fa-solid fa-pause"></i> Pause Song');
    } else {
      audio.pause();
      $(this).html('<i class="fa-solid fa-play"></i> Play Song');
    }
  });

  $(audio).on("ended", function () {
    $("#playBtn").html('<i class="fa-solid fa-play"></i> Play Song');
  });

  // 🔊 Volume
  $("#volumeBar").on("input", function () {
    const vol = parseFloat($(this).val());
    audio.volume = vol;
    audio.muted = false; // unmute when adjusted manually
    updateVolumeIcon(vol);
  });

  // 🔇 Mute / Unmute
  $("#muteBtn").on("click", function () {
    if (audio.muted) {
      audio.muted = false;
      $(this).html('<i class="fa-solid fa-volume-high"></i>');
      $("#volumeBar").val(audio.volume || 1);
    } else {
      audio.muted = true;
      $("#volumeBar").val(0);
      $(this).html('<i class="fa-solid fa-volume-xmark"></i>');
    }
  });

  // Keep volume slider synced even if volume changes externally
  $(audio).on("volumechange", function () {
    const vol = audio.muted ? 0 : audio.volume;
    $("#volumeBar").val(vol);
    updateVolumeIcon(vol);
  });

  // Change volume icon based on level
  function updateVolumeIcon(vol) {
    console.log(vol);
    let icon = '<i class="fa-solid fa-volume-xmark"></i>';
    if (vol > 0.66) icon = '<i class="fa-solid fa-volume-high"></i>';
    else if (vol > 0.01) icon = '<i class="fa-solid fa-volume-low"></i>';
    else if (vol == 0) icon = '<i class="fa-solid fa-volume-off"></i>';
    $("#muteBtn").html(icon);
  }
});
