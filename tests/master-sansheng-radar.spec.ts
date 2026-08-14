import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MasterSanshengRadar from "@/features/master/MasterSanshengRadar.vue";
import { COUNTY_SANSHENG_SCORES } from "@/features/master/sanshengSelection";
import {
  DEFAULT_DIMENSION_WEIGHTS,
  scoreTown,
  towns,
} from "@/features/sansheng/model";

describe("主控页面三生诊断雷达", () => {
  it("县域模式只显示主轮廓与精确分数", () => {
    const wrapper = mount(MasterSanshengRadar, {
      props: {
        areaName: "兰考县",
        scope: "county",
        scores: COUNTY_SANSHENG_SCORES,
      },
    });

    expect(wrapper.find(".diagnostic-radar__current").exists()).toBe(true);
    expect(wrapper.find(".diagnostic-radar__reference").exists()).toBe(false);
    expect(wrapper.text()).toContain("生态88.0");
    expect(wrapper.find(".diagnostic-radar__composite").exists()).toBe(false);
    expect(wrapper.text()).toContain("兰考县综合评价86.7");
    expect(wrapper.text()).toContain("优势生产空间");
    expect(wrapper.text()).toContain("短板生活空间");
  });

  it("乡镇模式显示县域参考与自动诊断", () => {
    const town = towns.find((item) => item.name === "红庙镇")!;
    const scores = scoreTown(town, DEFAULT_DIMENSION_WEIGHTS);
    const wrapper = mount(MasterSanshengRadar, {
      props: {
        areaName: town.name,
        scope: "township",
        scores,
        referenceScores: COUNTY_SANSHENG_SCORES,
      },
    });

    expect(wrapper.find(".diagnostic-radar__reference").exists()).toBe(true);
    expect(wrapper.text()).toContain("县域参考");
    expect(wrapper.find(".diagnostic-radar__composite").exists()).toBe(false);
    expect(wrapper.text()).toContain(
      `红庙镇综合评价${scores.composite.toFixed(1)}`,
    );
    expect(wrapper.text()).toContain("优势生产空间");
    expect(wrapper.text()).toContain("短板生活空间");
  });
});
