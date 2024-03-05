/* eslint-disable max-len */
import { html } from 'lit';

import { tw } from '../style.js';
import { XcmJourneyType } from '../lib/kb.js';

export function IconArrow() {
  return html`
    <svg class=${tw`w-4 h-4`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M1 5h12m0 0L9 1m4 4L9 9"
      />
    </svg>
  `;
}

export function IconChevron() {
  return html`
    <svg
      class=${tw`pointer-events-none z-10 right-1 relative col-start-1 row-start-1 h-4 w-4 self-center justify-self-end`}
      fill="rgba(255,255,255,0.5)"
      aria="hidden:true"
    >
      <path
        fill-rule="evenodd"
        d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
        clip-rule="evenodd"
      ></path>
    </svg>
  `;
}

export function IconSpinner() {
  return html`<div role="status">
    <svg
      aria-hidden="true"
      class=${tw`inline w-8 h-8 animate-spin text-gray-600`}
      viewBox="0 0 100 101"
      fill="yellow"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
  </div>`;
}

export function IconPulse() {
  return html`<span class=${tw`inline-block animate-pulse w-2 h-3 bg-yellow-400`}></span>`;
}

export function IconWait() {
  return html`
    <div class=${tw`flex items-center h-8`}>
      <div class=${tw`z-10 flex items-center justify-center w-6 h-6 rounded-full ring-2 bg-transparent ring-gray-900`}>
        <span class=${tw`inline-block animate-pulse w-3 h-3 bg-yellow-600 rounded-full`}></span>
      </div>
    </div>
  `;
}

export function IconSuccess() {
  return html`
    <div class=${tw`flex items-center h-8`}>
      <div class=${tw`z-10 flex items-center justify-center w-6 h-6 rounded-full bg-transparent ring-2 ring-green-600`}>
        <svg
          class=${tw`w-2.5 h-2.5 text-green-300`}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 16 12"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M1 5.917 5.724 10.5 15 1.5"
          />
        </svg>
      </div>
    </div>
  `;
}

export function IconFail() {
  return html` <div class=${tw`flex items-center h-8`}>
    <div class=${tw`z-10 flex items-center justify-center w-6 h-6 rounded-full bg-transparent ring-2 ring-red-600`}>
      <svg
        class=${tw` h-4 w-4 fill-current text-red-500`}
        role="status"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path
          d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"
        />
      </svg>
    </div>
  </div>`;
}

function getIconByChainId(id) {
  switch (id) {
    case '0': // polkadot
      return html`
        <svg class=${tw`w-6 h-6`} viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="800" rx="400" fill="#E6007A" />
          <path
            d="M400.072 246.038C452.666 246.038 495.302 221.181 495.302 190.519C495.302 159.857 452.666 135 400.072 135C347.478 135 304.843 159.857 304.843 190.519C304.843 221.181 347.478 246.038 400.072 246.038Z"
            fill="white"
          />
          <path
            d="M400.072 664.364C452.666 664.364 495.302 639.507 495.302 608.845C495.302 578.183 452.666 553.326 400.072 553.326C347.478 553.326 304.843 578.183 304.843 608.845C304.843 639.507 347.478 664.364 400.072 664.364Z"
            fill="white"
          />
          <path
            d="M267.363 322.89C293.66 277.233 293.489 227.785 266.982 212.443C240.475 197.102 197.668 221.677 171.371 267.333C145.074 312.989 145.245 362.438 171.753 377.779C198.26 393.121 241.066 368.546 267.363 322.89Z"
            fill="white"
          />
          <path
            d="M628.731 532.027C655.028 486.371 654.872 436.931 628.382 421.6C601.893 406.269 559.101 430.852 532.804 476.508C506.507 522.165 506.663 571.605 533.153 586.936C559.643 602.267 602.434 577.684 628.731 532.027Z"
            fill="white"
          />
          <path
            d="M266.996 586.923C293.503 571.582 293.674 522.133 267.377 476.477C241.08 430.821 198.274 406.246 171.766 421.587C145.259 436.929 145.088 486.377 171.385 532.034C197.682 577.69 240.488 602.265 266.996 586.923Z"
            fill="white"
          />
          <path
            d="M628.405 377.792C654.894 362.461 655.051 313.02 628.754 267.364C602.457 221.708 559.665 197.124 533.175 212.455C506.686 227.787 506.53 277.227 532.827 322.883C559.124 368.539 601.915 393.123 628.405 377.792Z"
            fill="white"
          />
        </svg>
      `;
    case '1000': // ah
      return html`
        <svg
          class=${tw`w-6 h-6`}
          x="0px"
          y="0px"
          viewBox="0 0 640 640"
          style="enable-background:new 0 0 640 640;"
          xml:space="preserve"
        >
          <style type="text/css">
            .st0 {
              fill: #321d47;
            }
            .st1 {
              fill: #ffffff;
            }
            .st2 {
              fill: #e6007a;
            }
          </style>
          <g>
            <path
              class="st0"
              d="M637.3,319.3c0,175.2-142,317.3-317.3,317.3S2.7,494.6,2.7,319.3S144.8,2.1,320,2.1S637.3,144.1,637.3,319.3z"
            />
            <path
              class="st1"
              d="M444.2,392.4h-67.6l-12.7-31h-85.8l-12.7,31h-67.6l80.9-184.3h84.5L444.2,392.4z M321.1,256l-22.4,55h44.7   L321.1,256z"
            />
            <circle class="st2" cx="321" cy="122.1" r="46.9" />
            <circle class="st2" cx="321" cy="517.1" r="46.9" />
            <circle class="st2" cx="147.8" cy="216" r="46.9" />
            <circle class="st2" cx="494.3" cy="216" r="46.9" />
            <circle class="st2" cx="147.8" cy="424.8" r="46.9" />
            <circle class="st2" cx="494.3" cy="424.8" r="46.9" />
          </g>
        </svg>
      `;
    case '2000': // acala
      return html`
        <svg class=${tw`w-6 h-6`} viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M43.6965 49.5651C41.9108 49.5651 40.1744 49.714 38.4945 49.9987L41.0816 45.5178C41.9549 45.4602 42.8293 45.4311 43.6965 45.4311C45.7279 45.4311 47.7949 45.5987 49.7933 45.9193L39.7478 28.52L23.0252 57.4845L20.6353 53.3451L39.7102 20.3065L39.7495 20.3746L39.7871 20.3094L62.8067 60.1805H58.0269L52.6468 50.8618C49.8436 50.0164 46.8468 49.5651 43.6965 49.5651Z"
            fill="url(#paint0_linear)"
          />
          <path
            d="M64.2943 57.5542L42.0076 18.9526H46.7873L66.6841 53.4149L64.2943 57.5542Z"
            fill="url(#paint1_linear)"
          />
          <path
            d="M42.1743 37.997L33.0231 53.8475C36.2974 52.8596 40.152 52.4185 43.7884 52.4185C44.0823 52.4185 44.377 52.422 44.6722 52.429C46.7381 52.4778 48.825 52.6964 50.8248 53.0697L53.8779 58.3579C50.7525 57.2211 47.3696 56.5524 43.7884 56.5524C38.4919 56.5524 33.6277 57.8624 29.3915 60.1414L29.4581 60.0221L29.3668 60.1804H24.587L39.7845 33.8577L42.1743 37.997Z"
            fill="url(#paint2_linear)"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M44 80.8163C64.3331 80.8163 80.8163 64.3331 80.8163 44C80.8163 23.6669 64.3331 7.18367 44 7.18367C23.6669 7.18367 7.18367 23.6669 7.18367 44C7.18367 64.3331 23.6669 80.8163 44 80.8163ZM44.0898 76.3265C61.9928 76.3265 76.5061 61.8132 76.5061 43.9102C76.5061 26.0072 61.9928 11.4939 44.0898 11.4939C26.1868 11.4939 11.6735 26.0072 11.6735 43.9102C11.6735 61.8132 26.1868 76.3265 44.0898 76.3265Z"
            fill="url(#paint3_linear)"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M44 88C68.3005 88 88 68.3005 88 44C88 19.6995 68.3005 0 44 0C19.6995 0 0 19.6995 0 44C0 68.3005 19.6995 88 44 88ZM44.1796 83.8694C66.1988 83.8694 84.049 66.0193 84.049 44C84.049 21.9807 66.1988 4.13061 44.1796 4.13061C22.1603 4.13061 4.3102 21.9807 4.3102 44C4.3102 66.0193 22.1603 83.8694 44.1796 83.8694Z"
            fill="url(#paint4_linear)"
          />
          <defs>
            <linearGradient
              id="paint0_linear"
              x1="132.24"
              y1="57.577"
              x2="65.1457"
              y2="-20.9227"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#645AFF" />
              <stop offset="0.5238" stop-color="#E40C5B" />
              <stop offset="1" stop-color="#FF4C3B" />
            </linearGradient>
            <linearGradient
              id="paint1_linear"
              x1="132.24"
              y1="57.577"
              x2="65.1457"
              y2="-20.9227"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#645AFF" />
              <stop offset="0.5238" stop-color="#E40C5B" />
              <stop offset="1" stop-color="#FF4C3B" />
            </linearGradient>
            <linearGradient
              id="paint2_linear"
              x1="132.24"
              y1="57.577"
              x2="65.1457"
              y2="-20.9227"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#645AFF" />
              <stop offset="0.5238" stop-color="#E40C5B" />
              <stop offset="1" stop-color="#FF4C3B" />
            </linearGradient>
            <linearGradient
              id="paint3_linear"
              x1="132.24"
              y1="57.577"
              x2="65.1457"
              y2="-20.9227"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#645AFF" />
              <stop offset="0.5238" stop-color="#E40C5B" />
              <stop offset="1" stop-color="#FF4C3B" />
            </linearGradient>
            <linearGradient
              id="paint4_linear"
              x1="132.24"
              y1="57.577"
              x2="65.1457"
              y2="-20.9227"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#645AFF" />
              <stop offset="0.5238" stop-color="#E40C5B" />
              <stop offset="1" stop-color="#FF4C3B" />
            </linearGradient>
          </defs>
        </svg>
      `;
    case '2004': // moonbeam
      return html`
        <svg
          class=${tw`w-6 h-6`}
          viewBox="0 0 100 100"
          fill="none"
          version="1.1"
          id="svg26"
          sodipodi:docname="moonbeam.svg"
          xml:space="preserve"
          inkscape:version="1.2.2 (732a01da63, 2022-12-09)"
          xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
          xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:svg="http://www.w3.org/2000/svg"
        >
          <sodipodi:namedview
            id="namedview28"
            pagecolor="#ffffff"
            bordercolor="#000000"
            borderopacity="0.25"
            inkscape:showpageshadow="2"
            inkscape:pageopacity="0.0"
            inkscape:pagecheckerboard="0"
            inkscape:deskcolor="#d1d1d1"
            showgrid="false"
            inkscape:zoom="3.5223214"
            inkscape:cx="-75.802282"
            inkscape:cy="5.252218"
            inkscape:window-width="1350"
            inkscape:window-height="1080"
            inkscape:window-x="3351"
            inkscape:window-y="285"
            inkscape:window-maximized="0"
            inkscape:current-layer="g1839-4"
          />
          <g
            inkscape:label="Layer 1"
            id="layer1"
            transform="matrix(0.36909447,0,0,0.36909447,-2.6100721e-6,9.2111272e-7)"
          >
            <circle
              r="0"
              cy="135.46666"
              cx="135.46666"
              id="path860"
              style="fill:#0d1126;fill-opacity:1;stroke:#0d1126;stroke-width:1.584;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
            />
            <g id="g1839-4" transform="matrix(3.0206892,0,0,3.0206892,-551.86599,-485.64457)">
              <circle
                r="44.846279"
                style="fill:#171e43;fill-opacity:1;stroke:none;stroke-width:0.625719"
                id="path862"
                cx="227.54167"
                cy="205.61905"
              />
              <g id="g891-6" transform="matrix(0.80007833,0,0,0.80007833,45.490514,41.107705)">
                <g transform="matrix(0.22669198,0,0,-0.22669198,235.05582,171.98763)" id="g1139-7">
                  <path
                    id="path1141-2"
                    style="fill:#53cbc8;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c -60.046,0 -108.724,-48.678 -108.724,-108.724 h 0.002 c 10e-4,-0.076 -0.004,-0.15 0,-0.227 l 0.009,-0.17 c 0.151,-2.834 2.513,-5.046 5.352,-5.046 h 206.722 c 2.839,0 5.202,2.212 5.352,5.046 l 0.009,0.17 c 0.004,0.077 -10e-4,0.151 0,0.227 h 0.002 C 108.724,-48.678 60.046,0 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,194.09364,224.15315)" id="g1143-3">
                  <path
                    id="path1145-4"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c 0,-3.653 -2.962,-6.616 -6.617,-6.616 -3.654,0 -6.616,2.963 -6.616,6.616 0,3.654 2.962,6.617 6.616,6.617 C -2.962,6.617 0,3.654 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,256.85765,215.85431)" id="g1147-8">
                  <path
                    id="path1149-0"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 h -221.817 c -4.935,0 -8.067,-5.268 -5.733,-9.616 0.036,-0.069 0.073,-0.138 0.111,-0.206 1.134,-2.106 3.342,-3.411 5.733,-3.411 H -0.112 c 2.391,0 4.599,1.305 5.734,3.411 0.037,0.068 0.074,0.137 0.111,0.206 C 8.066,-5.268 4.934,0 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,263.53996,202.25679)" id="g1151-3">
                  <path
                    id="path1153-4"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 h -251.302 c -3.746,0 -6.698,-3.151 -6.505,-6.892 0.004,-0.069 0.008,-0.138 0.012,-0.207 0.183,-3.445 3.054,-6.134 6.505,-6.134 H -0.012 c 3.45,0 6.322,2.689 6.505,6.134 C 6.497,-7.03 6.5,-6.961 6.504,-6.892 6.697,-3.151 3.746,0 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,242.08858,236.25059)" id="g1155-5">
                  <path
                    id="path1157-5"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 h -113.25 c -6.88,0 -9.047,-9.25 -2.905,-12.349 0.138,-0.069 0.276,-0.138 0.414,-0.208 0.901,-0.45 1.898,-0.676 2.906,-0.676 h 112.42 c 1.008,0 2.005,0.226 2.906,0.676 0.138,0.07 0.276,0.139 0.414,0.208 C 9.047,-9.25 6.88,0 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,257.77504,229.45183)" id="g1159-4">
                  <path
                    id="path1161-3"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 h -113.25 c -6.88,0 -9.047,-9.249 -2.905,-12.349 0.138,-0.069 0.276,-0.138 0.414,-0.208 0.901,-0.45 1.898,-0.676 2.906,-0.676 h 112.42 c 1.007,0 2.005,0.226 2.906,0.676 0.138,0.07 0.276,0.139 0.413,0.208 C 9.046,-9.249 6.879,0 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,222.76807,225.18097)" id="g1163-2">
                  <path
                    id="path1165-7"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c -0.064,0.068 -0.128,0.137 -0.193,0.205 -3.884,4.152 -0.906,10.946 4.779,10.946 h 183.808 c 5.686,0 8.663,-6.794 4.779,-10.946 C 193.109,0.137 193.045,0.068 192.981,0 191.74,-1.321 190.015,-2.082 188.203,-2.082 H 4.778 C 2.965,-2.082 1.241,-1.321 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,197.95105,222.65307)" id="g1167-8">
                  <path
                    id="path1169-4"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 h 87.773 c 6.88,0 9.047,-9.249 2.905,-12.349 -0.138,-0.069 -0.276,-0.138 -0.414,-0.207 -0.901,-0.451 -1.898,-0.677 -2.905,-0.677 H 0.415 c -1.007,0 -2.005,0.226 -2.906,0.677 -0.138,0.069 -0.276,0.138 -0.413,0.207 C -9.046,-9.249 -6.879,0 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,202.71535,203.7566)" id="g1171-6">
                  <path
                    id="path1173-8"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c 0,-3.654 -2.962,-6.616 -6.617,-6.616 -3.654,0 -6.616,2.962 -6.616,6.616 0,3.654 2.962,6.616 6.616,6.616 C -2.962,6.616 0,3.654 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,238.07276,210.96049)" id="g1175-2">
                  <path
                    id="path1177-4"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="M 0,0 C 0.019,0.068 0.037,0.138 0.056,0.206 1.175,4.339 -1.959,8.403 -6.24,8.403 h -183.832 c -4.282,0 -7.416,-4.064 -6.296,-8.197 0.018,-0.068 0.037,-0.138 0.056,-0.206 0.775,-2.846 3.346,-4.83 6.295,-4.83 H -6.295 c 2.949,0 5.519,1.984 6.295,4.83"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,191.12581,210.55536)" id="g1179-1">
                  <path
                    id="path1181-5"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c 0,-3.654 -2.962,-6.617 -6.617,-6.617 -3.654,0 -6.616,2.963 -6.616,6.617 0,3.654 2.962,6.616 6.616,6.616 C -2.962,6.616 0,3.654 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,202.71535,217.35412)" id="g1183-7">
                  <path
                    id="path1185-0"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c 0,-3.654 -2.962,-6.617 -6.617,-6.617 -3.654,0 -6.616,2.963 -6.616,6.617 0,3.654 2.962,6.616 6.616,6.616 C -2.962,6.616 0,3.654 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,228.24465,230.95191)" id="g1187-7">
                  <path
                    id="path1189-6"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c 0,-3.654 -2.962,-6.616 -6.617,-6.616 -3.654,0 -6.616,2.962 -6.616,6.616 0,3.654 2.962,6.617 6.616,6.617 C -2.962,6.617 0,3.654 0,0"
                  />
                </g>
                <g transform="matrix(0.22669198,0,0,-0.22669198,212.5583,237.75067)" id="g1191-1">
                  <path
                    id="path1193-1"
                    style="fill:#e1147b;fill-opacity:1;fill-rule:nonzero;stroke:none"
                    d="m 0,0 c 0,-3.654 -2.962,-6.616 -6.617,-6.616 -3.654,0 -6.616,2.962 -6.616,6.616 0,3.654 2.962,6.617 6.616,6.617 C -2.962,6.617 0,3.654 0,0"
                  />
                </g>
              </g>
              <text
                xml:space="preserve"
                style="font-size:17.5181px;line-height:1.25;font-family:Roboto;-inkscape-font-specification:Roboto;fill:#0d1126;fill-opacity:1;stroke-width:0.0875903"
                x="216.15707"
                y="194.15897"
                id="text864-6-2"
              >
                <tspan
                  sodipodi:role="line"
                  id="tspan862-3-9"
                  x="216.15707"
                  y="194.15897"
                  style="font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;font-size:17.5181px;font-family:'Varela Round';-inkscape-font-specification:'Varela Round';fill:#0d1126;fill-opacity:1;stroke-width:0.0875903"
                />
              </text>
            </g>
          </g>
          <defs id="defs24">
            <linearGradient id="paint0_linear" x1="50" y1="26.9736" x2="50" y2="72.3684" gradientUnits="userSpaceOnUse">
              <stop stop-color="#7AEDCF" id="stop8" />
              <stop offset="0.201333" stop-color="#68CEFA" id="stop10" />
              <stop offset="0.403244" stop-color="#689CF8" id="stop12" />
              <stop offset="0.602076" stop-color="#AC57C0" id="stop14" />
              <stop offset="0.801867" stop-color="#E65659" id="stop16" />
              <stop offset="1" stop-color="#F2C241" id="stop18" />
            </linearGradient>
            <clipPath id="clip0">
              <rect width="60.5263" height="45.3947" fill="white" transform="translate(19.7368 26.9736)" id="rect21" />
            </clipPath>
          </defs>
        </svg>
      `;
    case '2034': // hydra
      return html`
        <svg
          class=${tw`w-6 h-6`}
          viewBox="0 0 2001 2000"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          xml:space="preserve"
          xmlns:serif="http://www.serif.com/"
          style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"
        >
          <rect id="Pink-transp" x="0.054" y="0" width="2000" height="2000" style="fill:none;" />
          <path
            id="logo"
            d="M188.657,1000.03l811.686,-810.921l811.108,811.131l-811.108,810.653l-811.686,-810.863Zm1290.98,-243.392c-33.722,37.657 -107.253,132.484 -107.253,243.392c0,110.908 73.531,205.735 107.253,243.391c-216.633,-11.457 -389.843,-243.391 -389.843,-243.391c0,0 173.21,-231.935 389.843,-243.392Zm-957.995,0c216.633,11.457 389.843,243.392 389.843,243.392c0,0 -173.21,231.934 -389.843,243.391c33.722,-37.656 107.253,-132.483 107.253,-243.391c0,-110.908 -73.531,-205.735 -107.253,-243.392Zm-34.325,1.434c-34.273,38.551 -106.012,132.41 -106.012,241.958c0,109.976 72.302,204.141 106.414,242.409l175.471,175.5l0.824,-0.807c70.248,-68.649 187.023,-158.874 320.153,-165.746c-33.516,37.344 -107.428,132.295 -107.428,243.41c0,111.116 73.912,206.067 107.428,243.411l16.172,16.938l16.172,-16.938c33.516,-37.344 107.428,-132.295 107.428,-243.411c0,-111.115 -73.912,-206.066 -107.428,-243.41c133.651,6.899 250.819,97.805 320.977,166.553l179.611,-179.641l0.416,-0.478c35.513,-40.782 102.459,-131.966 102.459,-237.79c0,-106.239 -67.471,-197.723 -102.875,-238.268l-178.774,-178.804l-0.823,0.808c-70.177,68.741 -187.343,159.644 -320.991,166.543c33.516,-37.345 107.428,-132.296 107.428,-243.411c0,-111.116 -73.912,-206.067 -107.428,-243.411l-16.172,-18.572l-16.172,18.572c-33.516,37.344 -107.428,132.295 -107.428,243.411c0,111.115 73.912,206.066 107.428,243.411c-134.171,-6.926 -251.731,-98.515 -321.815,-167.351l-175.035,175.114Z"
            style="fill:#f653a2;"
          />
        </svg>
      `;
    case '2104': // manta
      return html`<span
        class=${tw`w-6 h-6`}
        style="background-image: url(/img/manta.png);background-size: cover;"
      ></span>`;
    default:
      return html`<span class=${tw`w-6 h-6`}></span>`;
  }
}

export function IconChain(id) {
  return html`
    <div class=${tw`flex items-center`}>
      <div class=${tw`z-10 flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 ring-1 ring-gray-800`}>
        ${getIconByChainId(id)}
      </div>
    </div>
  `;
}

export function IconChainFail(id) {
  return html`<div class=${tw`flex items-center`}>
    <div class=${tw`z-10 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-red-800`}>
      ${IconChain(id)}
    </div>
  </div>`;
}

export function IconChainSuccess(id) {
  return html`<div class=${tw`flex items-center`}>
    <div class=${tw`z-10 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-green-600`}>
      ${IconChain(id)}
    </div>
  </div>`;
}

export function IconChainWait(id) {
  return html`<div class=${tw`flex items-center`}>
    <div class=${tw`z-10 animate-pulse flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-yellow-800`}>
      ${IconChain(id)}
    </div>
  </div>`;
}

export function BadgeType(t: XcmJourneyType) {
  switch (t) {
    case XcmJourneyType.Transfer:
      return html`<span class=${tw`text-xs font-medium px-2.5 py-0.5 rounded bg-blue-900 text-blue-300`}>${t}</span>`;
    case XcmJourneyType.Teleport:
      return html`<span class=${tw`text-xs font-medium px-2.5 py-0.5 rounded bg-purple-900 text-purple-300`}
        >${t}</span
      >`;
    case XcmJourneyType.Transact:
      return html`<span class=${tw`text-xs font-medium px-2.5 py-0.5 rounded bg-yellow-900 text-yellow-300`}
        >${t}</span
      >`;
    default:
      return html`<span class=${tw`text-xs font-medium px-2.5 py-0.5 rounded bg-gray-700 text-gray-300`}>${t}</span>`;
  }
}
