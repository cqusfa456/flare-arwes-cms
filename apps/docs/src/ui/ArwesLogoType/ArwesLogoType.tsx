import React, { type ReactElement } from 'react'
import { type AnimatedProp, memo, Animated, cx } from '@arwes/react'
import { animate, stagger } from 'motion'

interface ArwesLogoTypeProps {
  className?: string
  animated?: AnimatedProp
}

/**
 * The site's wordmark.
 *
 * Drawn from one geometric alphabet — heavy strokes, 45° cuts, flat terminations — so
 * the letters read as a set: C, Q and U are built from that construction, S and A are
 * the original drawings, and F is E without its bottom arm. Each letter is its own
 * group, which is what the entering transition staggers.
 *
 * Two numbers keep the drawn letters level with the original ones:
 *
 * - Weight. S, F and A are filled outlines 78 units thick inside a 2-unit ring, so a
 *   drawn letter is a 78 stroke with an 82 halo under it and both share that outer
 *   edge. The 106 halo this started with made C, Q and U read heavier than the rest.
 * - Sidebearings. The offsets below leave 43 units after the C — wider on purpose,
 *   because nothing fills the right edge of its aperture — and 28 / 28 / 29 / 27
 *   between the other pairs. The Q reaches past its own body with its tail, so the
 *   letters after it carry the extra 14 units that keeps that gap in the same rhythm.
 */
const ArwesLogoType = memo((props: ArwesLogoTypeProps): ReactElement => {
  const { className, animated } = props
  return (
    <Animated<SVGSVGElement>
      as="svg"
      className={cx('select-none', className)}
      style={{
        filter: 'drop-shadow(0 0 8px hsla(180, 100%, 70%, 0.5))'
      }}
      viewBox="0 0 2480 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animated={[
        {
          transitions: {
            entering: ({ $, duration }) => {
              // Every letter group, in reading order — one per letter, however many the
              // wordmark has (this used to destructure five of them by name).
              const letters = $('g')
              return animate(
                letters,
                { opacity: [0, 1, 0.5, 1] },
                { duration, delay: stagger(0.02) }
              )
            },
            exiting: {
              opacity: [1, 0, 0.5, 0]
            }
          }
        },
        ...(Array.isArray(animated) ? animated : [animated])
      ]}
    >
      <g>
        <path
          d="M341 39H117L39 117V283L117 361H341"
          fill="none"
          stroke="#66FFFF"
          stroke-width="82"
          stroke-linejoin="miter"
        />
        <path
          d="M341 39H117L39 117V283L117 361H341"
          fill="none"
          stroke="#00FFFF"
          stroke-width="78"
          stroke-linejoin="miter"
        />
      </g>
      <g transform="translate(386, 0)">
        <path
          d="M117 39H283L361 117V283L283 361H117L39 283V117ZM255 255L385 385"
          fill="none"
          stroke="#66FFFF"
          stroke-width="82"
          stroke-linejoin="miter"
        />
        <path
          d="M117 39H283L361 117V283L283 361H117L39 283V117ZM255 255L385 385"
          fill="none"
          stroke="#00FFFF"
          stroke-width="78"
          stroke-linejoin="miter"
        />
      </g>
      <g transform="translate(830, 0)">
        <path
          d="M39 0V322L78 361H312L351 322V0"
          fill="none"
          stroke="#66FFFF"
          stroke-width="82"
          stroke-linejoin="miter"
        />
        <path
          d="M39 0V322L78 361H312L351 322V0"
          fill="none"
          stroke="#00FFFF"
          stroke-width="78"
          stroke-linejoin="miter"
        />
      </g>
      <g transform="translate(-580.66, 0)">
        <path
          d="M1833.69 397.87L1859.26 336.004H2066.26C2078.59 336.004 2088.6 333.367 2095.78 328.195C2104.47 322.414 2109.02 311.46 2109.22 295.639C2109.62 273.124 2099.01 256.998 2077.79 247.465C2060.6 239.554 2033.11 232.556 1996.12 226.471C1959.43 220.487 1928.6 211.562 1904.34 199.797C1884.43 190.365 1869.27 177.789 1859.26 162.678C1849.26 147.566 1844.2 129.209 1844.1 108.316C1844.1 76.2678 1856.53 49.8986 1880.99 30.0203C1903.84 11.4605 1932.14 2.02844 1965.09 2.02844H2170.47L2144.9 63.8946H1970.55C1957.51 63.8946 1946.89 68.0528 1939.11 76.2678C1931.33 84.28 1927.39 95.0305 1927.39 108.316C1927.39 127.586 1941.44 142.495 1969.13 152.637H1969.23H1969.33C1985.51 156.795 2010.07 161.562 2042.21 166.633C2074.15 171.704 2102.75 179.817 2127.21 190.872C2151.06 201.623 2169.16 215.923 2180.88 233.367C2192.61 250.811 2198.37 272.008 2197.96 296.248C2197.46 330.02 2184.42 356.187 2159.25 374.037C2136.61 389.757 2109.02 397.769 2077.18 397.769H1833.69V397.87Z"
          fill="#00FFFF"
        />
        <path
          d="M2167.44 4.0568L2143.48 61.8661H1970.55C1956.9 61.8661 1945.78 66.2272 1937.7 74.8479C1929.51 83.2657 1925.37 94.5233 1925.37 108.316C1925.37 128.499 1939.82 144.118 1968.42 154.564L1968.63 154.665H1968.83C1985.1 158.925 2009.66 163.59 2041.9 168.661C2073.64 173.732 2102.14 181.744 2126.4 192.698C2149.95 203.245 2167.74 217.343 2179.26 234.483C2190.79 251.623 2196.35 272.312 2196.04 296.247C2195.74 312.88 2192.51 327.688 2186.14 340.365C2179.87 352.941 2170.47 363.692 2158.24 372.414C2135.9 387.931 2108.71 395.74 2077.38 395.74H1836.82L1860.78 337.931H2066.26C2079 337.931 2089.31 335.193 2096.89 329.817C2106.19 323.529 2110.94 312.069 2111.14 295.639C2111.54 272.211 2100.53 255.375 2078.49 245.639C2061.11 237.627 2033.52 230.527 1996.32 224.544C1959.83 218.661 1929.21 209.736 1905.05 198.073C1885.44 188.742 1870.58 176.572 1860.78 161.663C1851.08 146.856 1846.02 128.905 1845.92 108.418C1845.92 92.6978 1848.95 78.2962 1854.92 65.5172C1860.88 52.8398 1869.98 41.3793 1882 31.643C1904.44 13.3874 1932.34 4.0568 1964.78 4.0568H2167.44ZM2173.5 0H1965.09C1931.43 0 1903.03 9.53347 1879.68 28.499C1854.61 48.9858 1842.08 75.5578 1842.08 108.418C1842.28 151.318 1862.7 182.454 1903.43 201.724C1927.99 213.59 1958.72 222.515 1995.81 228.499C2032.81 234.483 2059.9 241.481 2076.98 249.29C2097.5 258.418 2107.6 273.834 2107.3 295.538C2107.1 310.649 2102.95 320.994 2094.77 326.471C2087.89 331.44 2078.39 333.874 2066.36 333.874H1857.95L1830.66 399.797H2077.28C2109.62 399.797 2137.42 391.785 2160.46 375.761C2186.24 357.505 2199.48 331.034 2199.98 296.349C2200.69 246.755 2176.74 210.953 2128.02 189.047C2103.26 177.89 2074.75 169.777 2042.51 164.706C2010.27 159.635 1986.01 154.97 1969.84 150.71C1942.95 140.872 1929.51 126.673 1929.51 108.316C1929.51 95.5375 1933.25 85.2941 1940.73 77.6876C1948.21 69.8783 1958.21 65.9229 1970.75 65.9229H2146.42L2173.5 0Z"
          fill="#66FFFF"
        />
      </g>
      <g transform="translate(183.32, 0)">
        <path
          d="M1467.7 397.87V2.02844H1814.49L1788.92 63.8946H1545.73V397.769H1467.7V397.87Z M1557.86 230.832L1589.09 168.966H1811.76L1786.19 230.832H1557.86Z"
          fill="#00FFFF"
        />
        <path
          d="M1811.45 4.0568L1787.5 61.8661H1547.75H1543.71V65.9229V395.74H1469.72V4.0568H1811.45Z M1808.73 170.994L1784.77 228.803H1561.09L1590.3 170.994H1808.73Z M1817.52 0H1465.68V399.899H1547.75V65.9229H1790.23L1817.52 0Z M1814.79 166.937H1587.88L1554.62 232.86H1787.6L1814.79 166.937Z"
          fill="#66FFFF"
        />
      </g>
      <g transform="translate(2027.66, 0)">
        <path
          d="M365.182 397.87L226.204 108.925L114.922 338.641H295.036L325.358 397.87H3.33545L199.622 2.02844H252.484L448.77 397.87H365.182Z"
          fill="#00FFFF"
        />
        <path
          d="M251.17 4.0568L445.435 395.842H366.395L229.742 111.866L226.103 104.361L222.465 111.866L114.517 334.888L111.687 340.669H118.156H293.823L322.124 395.74H6.56983L200.835 4.0568H251.17ZM253.697 0H198.308L0 399.899H328.694L296.249 336.714H118.156L226.204 113.692L363.969 400H452.106L253.697 0Z"
          fill="#66FFFF"
        />
      </g>
    </Animated>
  )
})

export { ArwesLogoType }
