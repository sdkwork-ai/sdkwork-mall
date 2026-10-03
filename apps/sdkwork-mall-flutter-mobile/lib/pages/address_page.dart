import 'package:flutter/material.dart';

import '../services/commerce.dart';
import 'widgets.dart';

/// 地址管理: 列表 / 新增编辑（省市下拉 + 详细地址）/ 默认 / 删除.
class SdkworkAddressPage extends StatefulWidget {
  const SdkworkAddressPage({super.key});

  @override
  State<SdkworkAddressPage> createState() => _SdkworkAddressPageState();
}

class _SdkworkAddressPageState extends State<SdkworkAddressPage> {
  List<Map<String, dynamic>> _addresses = const [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('地址管理')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载地址...')
          : _error.isNotEmpty
              ? SdkworkErrorView(message: _error, onRetry: _load)
              : _addresses.isEmpty
                  ? const SdkworkEmptyView(message: '还没有收货地址')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        children: [
                          for (final address in _addresses) _buildAddressCard(address),
                        ],
                      ),
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editAddress(null),
        label: const Text('新增地址'),
        icon: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildAddressCard(Map<String, dynamic> address) {
    final addressId = '${address['id']}';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${address['receiverName']} ${address['receiverPhone']}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (address['isDefault'] == true)
                  const Text('默认', style: TextStyle(color: Color(0xFFE93B3D), fontSize: 12)),
              ],
            ),
            const SizedBox(height: 6),
            Text('${address['addressLine']}', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (address['isDefault'] != true)
                  TextButton(onPressed: () => _setDefault(addressId), child: const Text('设为默认')),
                TextButton(
                  onPressed: () => _editAddress(address),
                  child: const Text('编辑'),
                ),
                TextButton(onPressed: () => _delete(addressId), child: const Text('删除')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final addresses = await MallCommerce.instance.addresses.listAddresses();
      if (!mounted) {
        return;
      }
      setState(() {
        _addresses = addresses;
        _loading = false;
      });
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = '$cause';
      });
    }
  }

  Future<void> _editAddress(Map<String, dynamic>? address) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _AddressEditorSheet(address: address),
    );
    if (saved == true) {
      await _load();
    }
  }

  Future<void> _setDefault(String addressId) async {
    try {
      await MallCommerce.instance.addresses.setDefaultAddress(addressId);
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }

  Future<void> _delete(String addressId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('删除地址'),
        content: const Text('确定删除该收货地址？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    try {
      await MallCommerce.instance.addresses.deleteAddress(addressId);
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }
}

class _AddressEditorSheet extends StatefulWidget {
  const _AddressEditorSheet({required this.address});

  final Map<String, dynamic>? address;

  @override
  State<_AddressEditorSheet> createState() => _AddressEditorSheetState();
}

const _provinceCities = <Map<String, dynamic>>[
  {'province': '北京市', 'cities': <String>['北京市']},
  {'province': '上海市', 'cities': <String>['上海市']},
  {'province': '天津市', 'cities': <String>['天津市']},
  {'province': '重庆市', 'cities': <String>['重庆市']},
  {'province': '河北省', 'cities': <String>['石家庄市', '唐山市', '秦皇岛市', '保定市', '沧州市', '廊坊市']},
  {'province': '山西省', 'cities': <String>['太原市', '大同市', '长治市', '晋城市', '晋中市', '运城市', '临汾市']},
  {'province': '辽宁省', 'cities': <String>['沈阳市', '大连市', '鞍山市', '丹东市', '锦州市', '营口市']},
  {'province': '吉林省', 'cities': <String>['长春市', '吉林市', '四平市', '通化市', '松原市']},
  {'province': '黑龙江省', 'cities': <String>['哈尔滨市', '齐齐哈尔市', '大庆市', '佳木斯市', '牡丹江市']},
  {'province': '江苏省', 'cities': <String>['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '淮安市', '盐城市', '扬州市', '镇江市', '泰州市', '宿迁市']},
  {'province': '浙江省', 'cities': <String>['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市']},
  {'province': '安徽省', 'cities': <String>['合肥市', '芜湖市', '蚌埠市', '安庆市', '黄山市', '滁州市', '阜阳市', '宿州市', '六安市']},
  {'province': '福建省', 'cities': <String>['福州市', '厦门市', '莆田市', '泉州市', '漳州市', '南平市', '龙岩市', '宁德市']},
  {'province': '江西省', 'cities': <String>['南昌市', '景德镇市', '九江市', '赣州市', '吉安市', '宜春市', '抚州市', '上饶市']},
  {'province': '山东省', 'cities': <String>['济南市', '青岛市', '淄博市', '烟台市', '潍坊市', '济宁市', '泰安市', '威海市', '临沂市', '德州市']},
  {'province': '河南省', 'cities': <String>['郑州市', '开封市', '洛阳市', '安阳市', '新乡市', '许昌市', '南阳市', '商丘市', '信阳市']},
  {'province': '湖北省', 'cities': <String>['武汉市', '黄石市', '十堰市', '宜昌市', '襄阳市', '荆州市', '黄冈市', '孝感市']},
  {'province': '湖南省', 'cities': <String>['长沙市', '株洲市', '湘潭市', '衡阳市', '岳阳市', '常德市', '益阳市', '郴州市']},
  {'province': '广东省', 'cities': <String>['广州市', '深圳市', '珠海市', '汕头市', '佛山市', '惠州市', '东莞市', '中山市', '江门市', '湛江市', '揭阳市']},
  {'province': '四川省', 'cities': <String>['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '乐山市', '南充市', '宜宾市']},
  {'province': '陕西省', 'cities': <String>['西安市', '铜川市', '宝鸡市', '咸阳市', '渭南市', '延安市', '汉中市', '榆林市']},
  {'province': '云南省', 'cities': <String>['昆明市', '曲靖市', '玉溪市', '保山市', '丽江市', '大理白族自治州']},
  {'province': '广西壮族自治区', 'cities': <String>['南宁市', '柳州市', '桂林市', '梧州市', '北海市', '玉林市']},
  {'province': '海南省', 'cities': <String>['海口市', '三亚市', '儋州市']},
  {'province': '贵州省', 'cities': <String>['贵阳市', '六盘水市', '遵义市', '安顺市']},
  {'province': '甘肃省', 'cities': <String>['兰州市', '天水市', '武威市', '张掖市', '酒泉市']},
  {'province': '青海省', 'cities': <String>['西宁市', '海东市']},
  {'province': '宁夏回族自治区', 'cities': <String>['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市']},
  {'province': '新疆维吾尔自治区', 'cities': <String>['乌鲁木齐市', '克拉玛依市', '吐鲁番市', '哈密市']},
];

class _AddressEditorSheetState extends State<_AddressEditorSheet> {
  late final TextEditingController _name = TextEditingController(
    text: widget.address == null ? '' : '${widget.address!['receiverName'] ?? ''}',
  );
  late final TextEditingController _phone = TextEditingController(
    text: widget.address == null ? '' : '${widget.address!['receiverPhone'] ?? ''}',
  );
  late final TextEditingController _detail = TextEditingController();
  String _province = '';
  String _city = '';

  @override
  void initState() {
    super.initState();
    final addressLine = widget.address == null ? '' : '${widget.address!['addressLine'] ?? ''}';
    for (final entry in _provinceCities) {
      if (addressLine.startsWith('${entry['province']}')) {
        _province = '${entry['province']}';
        final rest = addressLine.substring(_province.length);
        for (final city in entry['cities'] as List<String>) {
          if (rest.startsWith(city)) {
            _city = city;
            _detail.text = rest.substring(city.length).trim();
            break;
          }
        }
        break;
      }
    }
    if (_detail.text.isEmpty) {
      _detail.text = addressLine;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _detail.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cities = <String>[
      for (final entry in _provinceCities)
        if ('${entry['province']}' == _province) ...(entry['cities'] as List<String>),
    ];
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.address == null ? '新增地址' : '编辑地址',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: '收货人', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            maxLength: 11,
            decoration: const InputDecoration(labelText: '联系电话（11 位手机号）', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _province.isEmpty ? null : _province,
                  decoration: const InputDecoration(labelText: '所在省', border: OutlineInputBorder()),
                  items: _provinceCities
                      .map(
                        (entry) => DropdownMenuItem<String>(
                          value: '${entry['province']}',
                          child: Text('${entry['province']}', overflow: TextOverflow.ellipsis),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() {
                    _province = value ?? '';
                    _city = '';
                  }),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _city.isEmpty ? null : _city,
                  decoration: const InputDecoration(labelText: '所在市', border: OutlineInputBorder()),
                  items: cities
                      .map(
                        (city) => DropdownMenuItem<String>(
                          value: city,
                          child: Text(city, overflow: TextOverflow.ellipsis),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => _city = value ?? ''),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _detail,
            decoration: const InputDecoration(
              labelText: '详细地址（区县 / 街道 / 门牌）',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: _save, child: const Text('保存')),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final phone = _phone.text.trim();
    final detail = _detail.text.trim();
    if (name.isEmpty || phone.isEmpty || _province.isEmpty || _city.isEmpty || detail.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请完整填写地址信息')));
      return;
    }
    if (!RegExp(r'^1[3-9]\d{9}$').hasMatch(phone)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请填写 11 位大陆手机号')));
      return;
    }
    final payload = <String, dynamic>{
      'addressLine': '$_province$_city $detail',
      'receiverName': name,
      'receiverPhone': phone,
    };
    try {
      final service = MallCommerce.instance.addresses;
      final existing = widget.address;
      if (existing == null) {
        await service.createAddress(
          addressLine: '${payload['addressLine']}',
          receiverName: name,
          receiverPhone: phone,
        );
      } else {
        await service.updateAddress(
          '${existing['id']}',
          addressLine: '${payload['addressLine']}',
          receiverName: name,
          receiverPhone: phone,
        );
      }
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }
}
