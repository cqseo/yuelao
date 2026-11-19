// lunar-javascript 沒有附型別；只宣告算命攤用到的部分。
declare module 'lunar-javascript' {
  export const Solar: {
    fromYmd(
      year: number,
      month: number,
      day: number,
    ): {
      getLunar(): {
        /** 以立春換年的生肖（簡體字：鼠牛虎兔龙蛇马羊猴鸡狗猪）。 */
        getYearShengXiaoByLiChun(): string;
        getEightChar(): unknown;
      };
    };
  };
}
