// lunar-javascript 沒有附型別；只宣告算命攤用到的部分。
declare module 'lunar-javascript' {
  interface EightChar {
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
  }
  interface Lunar {
    /** 以立春換年的生肖（簡體字：鼠牛虎兔龙蛇马羊猴鸡狗猪）。 */
    getYearShengXiaoByLiChun(): string;
    getEightChar(): EightChar;
  }
  interface SolarDay {
    getLunar(): Lunar;
  }
  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarDay;
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): SolarDay;
  };
}
