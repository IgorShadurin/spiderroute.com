export function Illustration() {
  return (
    <svg
      viewBox="0 0 800 600"
      className="route-illustration"
      role="img"
      aria-label="Illustrative coastal route map"
    >
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="#d7ded3" strokeWidth=".7" />
        </pattern>
        <filter id="shadow">
          <feDropShadow dx="0" dy="5" stdDeviation="6" floodOpacity=".14" />
        </filter>
      </defs>
      <rect width="800" height="600" fill="#eaf0e5" />
      <path
        d="M545-20C510 100 630 185 585 265S420 326 440 420s130 100 90 200H850V-20Z"
        fill="#c8dfe6"
      />
      <path
        d="M0 130c130-55 198 54 330-22S390-20 490 0M-20 400c150-95 246 15 338-70s145-118 240-64M50 650c50-170 114-207 290-220"
        stroke="#d8e3ce"
        strokeWidth="70"
        fill="none"
      />
      <rect width="800" height="600" fill="url(#grid)" />
      <g fill="none" stroke="#fffdf4" strokeWidth="12">
        <path d="m-10 240 170 30 90-108 124 14 133 115 4 97-130 137M135-20l48 180-23 110-44 148 35 192M-20 490l135-72 179-31 167-4M250 162l44 225 82 138M375 176l-81 211" />
      </g>
      <g fill="none" stroke="#c8ccbe" strokeWidth="1">
        <path d="m-10 240 170 30 90-108 124 14 133 115 4 97-130 137M135-20l48 180-23 110-44 148 35 192M-20 490l135-72 179-31 167-4M250 162l44 225 82 138" />
      </g>
      <g fill="#bed3ac" opacity=".7">
        <path d="m60 50 65-20 20 105-70 32Z" />
        <path d="m320 230 45-27 78 65-30 52Z" />
        <path d="m190 454 86-23 40 82-125 20Z" />
      </g>
      <path
        d="m166 301 21-72 62-68 126 15 76 63 55 53 7 94-54 39-103-6-64-32-134 24-20-53 16-57"
        stroke="white"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="m166 301 21-72 62-68 126 15 76 63 55 53 7 94-54 39-103-6-64-32-134 24-20-53 16-57"
        stroke="#ec653e"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx="160"
        cy="304"
        r="46"
        fill="#ec653e"
        fillOpacity=".08"
        stroke="#ec653e"
        strokeDasharray="5 5"
      />
      <circle
        cx="166"
        cy="301"
        r="9"
        fill="#203d30"
        stroke="white"
        strokeWidth="4"
      />
      <g filter="url(#shadow)">
        <rect x="410" y="162" width="145" height="46" rx="12" fill="white" />
        <text
          x="428"
          y="191"
          fontFamily="sans-serif"
          fontSize="14"
          fill="#254334"
        >
          ↗ Ocean lookout
        </text>
        <circle
          cx="451"
          cy="239"
          r="9"
          fill="#ec653e"
          stroke="white"
          strokeWidth="4"
        />
      </g>
      <g fontFamily="sans-serif" fill="#728776" fontSize="11" letterSpacing="3">
        <text x="65" y="96">
          GREEN PARK
        </text>
        <text x="251" y="302" transform="rotate(-28 251 302)">
          COASTAL TRAIL
        </text>
        <text x="639" y="363" fill="#739ba9" transform="rotate(-65 639 363)">
          ATLANTIC OCEAN
        </text>
      </g>
    </svg>
  );
}
