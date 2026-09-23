import { coachSituationMessage } from "@/features/home/model";

describe("coachSituationMessage", () => {
  it("딱지도 부스러기도 없으면 말하지 않는다", () => {
    expect(coachSituationMessage({ stickerCount: 0, removableToday: true, penalties: [] })).toBeNull();
  });

  it("압류 딱지가 있으면 딱지 수와 오늘 뗄 수 있는지 알려 준다", () => {
    expect(coachSituationMessage({ stickerCount: 7, removableToday: true, penalties: [] })).toBe(
      "예산을 모두 넘겨서 가구에 압류 딱지가 7개 붙었어요. 딱지를 누르면 오늘 하나를 뗄 수 있어요."
    );
    expect(coachSituationMessage({ stickerCount: 6, removableToday: false, penalties: [] })).toBe(
      "예산을 모두 넘겨서 가구에 압류 딱지가 6개 붙었어요. 딱지는 하루에 하나씩 뗄 수 있어요. 내일 다시 떼 봐요."
    );
  });

  it("딱지가 있으면 부스러기보다 딱지를 먼저 말한다", () => {
    const message = coachSituationMessage({
      stickerCount: 1,
      removableToday: true,
      penalties: [{ envelopeName: "외식", furnitureName: "식탁" }],
    });
    expect(message).toContain("압류 딱지가 1개");
    expect(message).not.toContain("식탁");
  });

  it("부스러기만 있으면 봉투와 가구를 받침에 맞는 조사로 말한다", () => {
    expect(coachSituationMessage({ stickerCount: 0, removableToday: true, penalties: [{ envelopeName: "외식", furnitureName: "식탁" }] })).toBe(
      "외식 예산을 넘겨서 식탁이 어질러졌어요. 봉투에 잔액이 다시 생기면 치워져요."
    );
    expect(
      coachSituationMessage({ stickerCount: 0, removableToday: true, penalties: [{ envelopeName: "취미·여가", furnitureName: "커피 테이블" }] })
    ).toBe("취미·여가 예산을 넘겨서 커피 테이블이 어질러졌어요. 봉투에 잔액이 다시 생기면 치워져요.");
  });

  it("색상 변형 표기는 떼고 가구 종류만 부른다", () => {
    expect(
      coachSituationMessage({
        stickerCount: 0,
        removableToday: true,
        penalties: [
          { envelopeName: "외식", furnitureName: "식탁 (오리지널)" },
          { envelopeName: "취미·여가", furnitureName: "커피 테이블 (핑크)" },
        ],
      })
    ).toBe("외식과 취미·여가 예산을 넘겨서 식탁과 커피 테이블이 어질러졌어요. 봉투에 잔액이 다시 생기면 치워져요.");
  });

  it("두 가구가 함께 어질러지면 과/와 로 잇고 같은 이름은 한 번만 쓴다", () => {
    expect(
      coachSituationMessage({
        stickerCount: 0,
        removableToday: true,
        penalties: [
          { envelopeName: "외식", furnitureName: "식탁" },
          { envelopeName: "외식", furnitureName: "식탁" },
          { envelopeName: "취미·여가", furnitureName: "커피 테이블" },
        ],
      })
    ).toBe("외식과 취미·여가 예산을 넘겨서 식탁과 커피 테이블이 어질러졌어요. 봉투에 잔액이 다시 생기면 치워져요.");
  });
});
