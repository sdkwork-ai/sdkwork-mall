import {
  errorMessage,
  type MpInputEvent,
  type MpPickerChangeEvent,
  type MpTapEvent,
} from "../../types/common";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type MpAddress,
} from "../../services/address-service";

const PROVINCE_CITIES: Array<{ province: string; cities: string[] }> = [
  { province: "北京市", cities: ["北京市"] },
  { province: "上海市", cities: ["上海市"] },
  { province: "天津市", cities: ["天津市"] },
  { province: "重庆市", cities: ["重庆市"] },
  { province: "河北省", cities: ["石家庄市", "唐山市", "秦皇岛市", "邯郸市", "保定市", "张家口市", "承德市", "沧州市", "廊坊市", "衡水市"] },
  { province: "山西省", cities: ["太原市", "大同市", "阳泉市", "长治市", "晋城市", "晋中市", "运城市", "临汾市", "吕梁市"] },
  { province: "辽宁省", cities: ["沈阳市", "大连市", "鞍山市", "抚顺市", "丹东市", "锦州市", "营口市", "盘锦市", "朝阳市", "葫芦岛市"] },
  { province: "吉林省", cities: ["长春市", "吉林市", "四平市", "通化市", "松原市", "白城市"] },
  { province: "黑龙江省", cities: ["哈尔滨市", "齐齐哈尔市", "大庆市", "佳木斯市", "牡丹江市", "绥化市"] },
  { province: "江苏省", cities: ["南京市", "无锡市", "徐州市", "常州市", "苏州市", "南通市", "连云港市", "淮安市", "盐城市", "扬州市", "镇江市", "泰州市", "宿迁市"] },
  { province: "浙江省", cities: ["杭州市", "宁波市", "温州市", "嘉兴市", "湖州市", "绍兴市", "金华市", "衢州市", "舟山市", "台州市", "丽水市"] },
  { province: "安徽省", cities: ["合肥市", "芜湖市", "蚌埠市", "淮南市", "马鞍山市", "安庆市", "黄山市", "滁州市", "阜阳市", "宿州市", "六安市"] },
  { province: "福建省", cities: ["福州市", "厦门市", "莆田市", "三明市", "泉州市", "漳州市", "南平市", "龙岩市", "宁德市"] },
  { province: "江西省", cities: ["南昌市", "景德镇市", "萍乡市", "九江市", "新余市", "赣州市", "吉安市", "宜春市", "抚州市", "上饶市"] },
  { province: "山东省", cities: ["济南市", "青岛市", "淄博市", "枣庄市", "东营市", "烟台市", "潍坊市", "济宁市", "泰安市", "威海市", "日照市", "临沂市", "德州市", "聊城市", "滨州市", "菏泽市"] },
  { province: "河南省", cities: ["郑州市", "开封市", "洛阳市", "平顶山市", "安阳市", "新乡市", "焦作市", "许昌市", "南阳市", "商丘市", "信阳市", "周口市", "驻马店市"] },
  { province: "湖北省", cities: ["武汉市", "黄石市", "十堰市", "宜昌市", "襄阳市", "鄂州市", "荆门市", "孝感市", "荆州市", "黄冈市", "咸宁市", "随州市"] },
  { province: "湖南省", cities: ["长沙市", "株洲市", "湘潭市", "衡阳市", "邵阳市", "岳阳市", "常德市", "张家界市", "益阳市", "郴州市", "永州市", "怀化市", "娄底市"] },
  { province: "广东省", cities: ["广州市", "深圳市", "珠海市", "汕头市", "佛山市", "江门市", "湛江市", "茂名市", "肇庆市", "惠州市", "梅州市", "汕尾市", "河源市", "阳江市", "清远市", "东莞市", "中山市", "潮州市", "揭阳市", "云浮市"] },
  { province: "广西壮族自治区", cities: ["南宁市", "柳州市", "桂林市", "梧州市", "北海市", "防城港市", "钦州市", "贵港市", "玉林市", "百色市", "贺州市", "河池市", "来宾市", "崇左市"] },
  { province: "海南省", cities: ["海口市", "三亚市", "儋州市"] },
  { province: "四川省", cities: ["成都市", "自贡市", "攀枝花市", "泸州市", "德阳市", "绵阳市", "广元市", "遂宁市", "内江市", "乐山市", "南充市", "眉山市", "宜宾市", "广安市", "达州市", "雅安市", "巴中市", "资阳市"] },
  { province: "贵州省", cities: ["贵阳市", "六盘水市", "遵义市", "安顺市", "毕节市", "铜仁市"] },
  { province: "云南省", cities: ["昆明市", "曲靖市", "玉溪市", "保山市", "昭通市", "丽江市", "普洱市", "临沧市", "大理白族自治州"] },
  { province: "西藏自治区", cities: ["拉萨市", "日喀则市", "昌都市", "林芝市", "山南市", "那曲市"] },
  { province: "陕西省", cities: ["西安市", "铜川市", "宝鸡市", "咸阳市", "渭南市", "延安市", "汉中市", "榆林市", "安康市", "商洛市"] },
  { province: "甘肃省", cities: ["兰州市", "嘉峪关市", "金昌市", "白银市", "天水市", "武威市", "张掖市", "平凉市", "酒泉市", "庆阳市", "定西市", "陇南市"] },
  { province: "青海省", cities: ["西宁市", "海东市"] },
  { province: "宁夏回族自治区", cities: ["银川市", "石嘴山市", "吴忠市", "固原市", "中卫市"] },
  { province: "新疆维吾尔自治区", cities: ["乌鲁木齐市", "克拉玛依市", "吐鲁番市", "哈密市"] },
];

function detectRegion(addressLine: string): { province: string; city: string; detail: string } {
  for (const entry of PROVINCE_CITIES) {
    if (addressLine.indexOf(entry.province) === 0) {
      const rest = addressLine.slice(entry.province.length);
      for (const city of entry.cities) {
        if (rest.indexOf(city) === 0) {
          return { province: entry.province, city, detail: rest.slice(city.length).trim() };
        }
      }
    }
  }
  return { province: "", city: "", detail: addressLine };
}

interface AddressForm {
  province: string;
  city: string;
  detail: string;
  receiverName: string;
  receiverPhone: string;
}

interface AddressData {
  addresses: MpAddress[];
  provinces: string[];
  cities: string[];
  editing: boolean;
  editingId: string;
  form: AddressForm;
  loading: boolean;
  error: string;
  toast: string;
  _pickerMode: boolean;
  _toastTimer: number | null;
}

Page({
  data: {
    addresses: [],
    provinces: PROVINCE_CITIES.map((entry) => entry.province),
    cities: [],
    editing: false,
    editingId: "",
    form: { province: "", city: "", detail: "", receiverName: "", receiverPhone: "" },
    loading: true,
    error: "",
    toast: "",
    _pickerMode: false,
    _toastTimer: null,
  } as AddressData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _pickerMode: options.picker === "1" });
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true, error: "" });
    try {
      const addresses = await listAddresses();
      this.setData({ addresses, loading: false });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "地址加载失败"),
      });
    }
  },

  pickAddress(event: MpTapEvent) {
    if (!this.data._pickerMode) {
      return;
    }
    const addressId = String(event.currentTarget.dataset.id ?? "");
    const address = this.data.addresses.find((entry) => entry.id === addressId);
    if (!address) {
      return;
    }
    // Page instances do not declare getOpenerEventChannel in
    // miniprogram-api-typings (it is typed on Component only), so a narrow
    // structural cast is required to reach the opener EventChannel.
    const host = this as unknown as {
      getOpenerEventChannel?: () => { emit?: (eventName: string, ...args: unknown[]) => void };
    };
    const eventChannel = host.getOpenerEventChannel && host.getOpenerEventChannel();
    if (eventChannel && eventChannel.emit) {
      eventChannel.emit("addressPicked", address);
    }
    wx.navigateBack();
  },

  openCreate() {
    this.setData({
      editing: true,
      editingId: "",
      cities: [],
      form: { province: "", city: "", detail: "", receiverName: "", receiverPhone: "" },
    });
  },

  openEdit(event: MpTapEvent) {
    const addressId = String(event.currentTarget.dataset.id ?? "");
    const address = this.data.addresses.find((entry) => entry.id === addressId);
    if (!address) {
      return;
    }
    const region = detectRegion(address.addressLine);
    const provinceEntry = PROVINCE_CITIES.find((entry) => entry.province === region.province);
    this.setData({
      editing: true,
      editingId: address.id,
      cities: provinceEntry ? provinceEntry.cities : [],
      form: {
        province: region.province,
        city: region.city,
        detail: region.detail,
        receiverName: address.receiverName,
        receiverPhone: address.receiverPhone,
      },
    });
  },

  closeEditor() {
    this.setData({ editing: false });
  },

  onProvinceChange(event: MpPickerChangeEvent) {
    const province = this.data.provinces[Number(event.detail.value)];
    const entry = PROVINCE_CITIES.find((candidate) => candidate.province === province);
    this.setData({
      cities: entry ? entry.cities : [],
      form: { ...this.data.form, province, city: "" },
    });
  },

  onCityChange(event: MpPickerChangeEvent) {
    const city = this.data.cities[Number(event.detail.value)];
    this.setData({ form: { ...this.data.form, city } });
  },

  onDetailInput(event: MpInputEvent) {
    this.setData({ form: { ...this.data.form, detail: event.detail.value } });
  },

  onNameInput(event: MpInputEvent) {
    this.setData({ form: { ...this.data.form, receiverName: event.detail.value } });
  },

  onPhoneInput(event: MpInputEvent) {
    this.setData({ form: { ...this.data.form, receiverPhone: event.detail.value } });
  },

  async save() {
    const { form, editingId } = this.data;
    if (!form.receiverName.trim() || !form.receiverPhone.trim()) {
      this.showToast("请填写收货人与电话");
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(form.receiverPhone.trim())) {
      this.showToast("请填写 11 位大陆手机号");
      return;
    }
    if (!form.province || !form.city) {
      this.showToast("请选择所在省 / 市");
      return;
    }
    if (!form.detail.trim()) {
      this.showToast("请填写详细地址");
      return;
    }
    const payload = {
      receiverName: form.receiverName.trim(),
      receiverPhone: form.receiverPhone.trim(),
      addressLine: `${form.province}${form.city} ${form.detail.trim()}`,
    };
    try {
      if (editingId) {
        await updateAddress(editingId, payload);
      } else {
        await createAddress(payload);
      }
      this.setData({ editing: false });
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, "保存失败"));
    }
  },

  async setDefault(event: MpTapEvent) {
    try {
      await setDefaultAddress(String(event.currentTarget.dataset.id ?? ""));
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, "设置默认失败"));
    }
  },

  async remove(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    wx.showModal({
      title: "删除地址",
      content: "确定删除该收货地址？",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await deleteAddress(id);
          await this.refresh();
        } catch (cause) {
          this.showToast(errorMessage(cause, "删除失败"));
        }
      },
    });
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },
});
