(function () {
  if (window.__proCall) return;
  window.__proCall = true;

  const modal = document.createElement("div");
  modal.className = "pro-back";
  modal.id = "proCall";
  modal.innerHTML = `
    <div class="pro-modal" role="dialog" aria-modal="true" aria-labelledby="proTitle">
      <span class="pro-stamp">ՇՈՒՏ · ՍԱ ԿԱՏԱԿ Է · ՓՈՂ ՉԿԱ</span>
      <p class="pro-kicker">Բժիշկները շոկի մեջ են · տեղը վառվում է · մաման չհավանեց</p>
      <h2 id="proTitle">Pro-զանգ դեպի 911։ Գրեթե ձրի։ Լուրջ չէ։</h2>
      <div class="pro-price"><s>9 911 ֏</s><b>99 ֏</b><span>մեկանգամյա իմպուլս</span></div>
      <p class="pro-timer" id="proTimer">Մնացել է 09:11, հետո ժամաչափն ամաչելով նորից կսկսի</p>
      <div class="pro-marquee"><span>VIP հերթ նույն շտապօգնությանը · անտեսանելի ստետոսկոպ · սպեղանու NFT · 98% զեղչ, որ միշտ 99 ֏ է · բոնուս՝ զգացողություն, որ գովազդից խելոք եք · &nbsp; VIP հերթ նույն շտապօգնությանը · անտեսանելի ստետոսկոպ · սպեղանու NFT · 98% զեղչ, որ միշտ 99 ֏ է · բոնուս՝ զգացողություն, որ գովազդից խելոք եք · &nbsp;</span></div>
      <ul class="pro-perks" id="proPerks">
        <li>Մնացել է 2 արտոնագիր 911-ից։ Երրորդը փախավ ջուր խմելու։</li>
        <li>Կարծիք. «Գնեցի։ Զանգեցի։ Փողը չգանձվեց, որովհետև կոճակը ստվարաթուղթ է»։ ★★★★★</li>
        <li>Բախտի անիվն արդեն պտտվել է ձեր փոխարեն և ընկել «միևնույն է՝ 99»։</li>
        <li>911-ն իրոք անվճար է։ Պատուհանը կա, որ ծիծաղենք։</li>
      </ul>
      <button class="pro-buy" type="button" id="proBuy">ՎԵՐՑՐՈՒ PRO-Ն ԵՎ ԶԱՆԳԻՐ 911</button>
      <p class="pro-fine">Քարտ չենք ուզում։ Հաշիվ չկա։ Սա կլիքբեյթի ծաղրանկար է, ոչ թե դրամարկղ։ Իսկական 911-ը անվճար է և առանց բաժանորդագրության։</p>
      <button class="btn btn-ghost btn-sm" type="button" id="proClose" style="margin-top:10px">Փակել կրկեսը</button>
    </div>`;
  document.body.appendChild(modal);

  let left = 9 * 60 + 11;
  const timer = modal.querySelector("#proTimer");
  setInterval(() => {
    if (!modal.classList.contains("open")) return;
    left -= 1;
    if (left < 0) {
      left = 9 * 60 + 11;
      timer.textContent = "Ժամաչափը մտափոխվեց ու սկսեց նորից։ Ցուցափեղկի դասական։";
      return;
    }
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    timer.textContent = "Հասցրեք " + m + ":" + s + "-ում · հետո գինը կմնա 99 ֏";
  }, 1000);

  function open() {
    modal.classList.add("open");
  }
  function close() {
    modal.classList.remove("open");
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-pro-call]")) {
      event.preventDefault();
      open();
    }
  });
  modal.querySelector("#proClose").addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  modal.querySelector("#proBuy").addEventListener("click", () => {
    const box = modal.querySelector(".pro-modal");
    const bits = ["#c24a3b", "#f2b429", "#146850", "#5aa0c4", "#fff"];
    const confetti = Array.from({ length: 18 }, (_, i) =>
      `<i style="--x:${(i * 6)}%;--c:${bits[i % bits.length]}"></i>`
    ).join("");
    box.innerHTML = `
      <div class="confetti">${confetti}</div>
      <div class="pro-won">
        <span class="pro-stamp">ԿՏՐՈՆ 0.00 ֏</span>
        <h2>Pro-ն միացավ։ Դրամապանակը նույնիսկ չնկատեց։</h2>
        <p>Կատակն ավարտվում է այնտեղ, որտեղ սկսվում են փողերը. դրանք չկային։ 911 զանգն անվճար է՝ առանց բաժանորդագրության և առանց այս կրկեսի։</p>
        <a class="btn btn-danger" href="tel:911">Զանգել 911</a>
        <p class="pro-fine">Եթե սա իրական արտակարգ է, մի սպասեք անիմացիային։ Հիմա հավաքեք 911։</p>
        <button class="btn btn-ghost btn-sm" type="button" id="proClose2">Փակել</button>
      </div>`;
    box.querySelector("#proClose2").addEventListener("click", close);
  });
})();
