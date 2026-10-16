import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Mapa de Perú por departamentos, coloreado por intensidad (choropleth) según
 * `counts` -- ej. cantidad de clientes por departamento. Geometría basada en
 * el GeoJSON público de departamentos del Perú (proyección equirectangular
 * simple, simplificada a ~1/3 de los puntos originales para mantener el SVG
 * liviano e inline, sin depender de un archivo/librería de mapas aparte).
 *
 * Los 25 `[attr.data-dep]` deben coincidir EXACTO (mayúsculas, sin tildes)
 * con los valores de `dwh.dim_cliente.departamento`/`ai.v_ventas.departamento`
 * (ver backend/batch schema-star.sql) para que el cruce en `colorFor()` matchee.
 */
@Component({
  selector: 'app-peru-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">{{ title() }}</span>
      </div>

      <div #mapContainer class="relative w-full max-w-md mx-auto">
        <svg viewBox="0 0 500 700" class="w-full h-auto" preserveAspectRatio="xMidYMid meet" role="img" [attr.aria-label]="title()">
          <g>
            <path [attr.data-dep]="'AMAZONAS'" [attr.fill]="colorFor('AMAZONAS')" (mousemove)="onPointerMove($event, 'AMAZONAS')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M144.2,264.7 L137.8,265.6 L132.8,253.7 L127.7,245.3 L122.2,240.1 L112.5,230.8 L107.8,221.4 L113.6,208.7 L111.9,201.5 L108.2,193.6 L110.3,188.2 L110.6,176.6 L109.7,171.7 L110.1,164.1 L114.3,154.3 L116.3,148.9 L119.6,141.3 L120.2,134.4 L122.8,128.3 L129.3,131.6 L137.6,114.5 L143.5,120.4 L149.6,137.4 L151.4,146.6 L152.2,155.6 L150.8,169.6 L143.7,178.9 L144.2,186.2 L141.8,192.8 L144.9,197.8 L146.6,205.4 L143.9,210.3 L144.0,221.0 L147.6,227.1 L154.9,227.9 L160.0,232.2 L165.6,236.7 L164.8,242.4 L162.8,243.4 L158.2,250.9 L152.4,253.8 L144.7,253.3 L145.6,262.0 L144.2,264.7 Z"></path>
            <path [attr.data-dep]="'ANCASH'" [attr.fill]="colorFor('ANCASH')" (mousemove)="onPointerMove($event, 'ANCASH')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M161.1,324.6 L163.3,329.1 L168.2,339.3 L174.0,345.0 L183.7,352.4 L179.2,352.6 L175.6,362.7 L173.7,371.2 L177.2,373.7 L180.5,384.0 L174.5,392.5 L170.5,393.7 L165.9,401.9 L158.1,406.1 L151.2,408.6 L148.7,403.6 L147.1,397.3 L144.4,393.1 L143.7,400.4 L139.3,404.2 L134.6,395.1 L128.7,386.4 L126.4,373.0 L121.0,366.3 L120.5,359.6 L116.8,355.2 L115.6,349.5 L111.1,345.5 L112.5,337.2 L117.9,332.5 L127.6,327.3 L129.7,320.7 L134.3,312.9 L142.2,306.9 L148.9,308.4 L155.7,317.2 L161.1,324.6 Z"></path>
            <path [attr.data-dep]="'APURIMAC'" [attr.fill]="colorFor('APURIMAC')" (mousemove)="onPointerMove($event, 'APURIMAC')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M346.3,559.0 L336.6,559.5 L332.0,562.7 L325.8,558.0 L318.8,560.7 L312.7,560.6 L307.6,565.9 L306.6,558.5 L305.7,552.5 L302.8,537.1 L300.2,530.5 L300.5,523.5 L295.0,514.9 L294.7,506.4 L298.4,505.7 L307.7,511.9 L317.2,513.7 L325.5,511.8 L330.5,511.4 L339.2,515.1 L348.2,518.6 L355.5,522.4 L362.2,531.0 L362.2,538.6 L357.2,545.7 L352.2,550.5 L348.0,552.0 L346.3,559.0 Z"></path>
            <path [attr.data-dep]="'AREQUIPA'" [attr.fill]="colorFor('AREQUIPA')" (mousemove)="onPointerMove($event, 'AREQUIPA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M246.9,588.8 L250.9,583.4 L256.7,577.2 L264.7,577.6 L272.7,578.8 L276.1,585.6 L280.5,590.7 L286.5,589.3 L290.0,590.7 L293.2,584.4 L300.0,588.6 L309.2,585.5 L315.2,583.2 L321.7,580.4 L326.0,574.4 L326.0,564.8 L332.7,560.5 L339.7,559.2 L345.8,560.9 L352.3,565.6 L359.4,565.4 L362.7,560.2 L365.9,561.5 L370.0,567.6 L373.2,572.3 L378.3,577.2 L383.0,574.9 L386.1,571.8 L392.6,574.8 L395.7,578.1 L396.2,583.0 L399.8,589.1 L402.0,590.6 L406.4,599.1 L409.4,609.3 L407.3,613.7 L403.1,622.0 L402.9,629.1 L393.2,628.0 L391.5,637.9 L386.3,638.4 L387.9,649.2 L385.7,658.0 L371.5,655.4 L362.9,649.0 L353.3,643.6 L347.2,637.0 L334.8,634.2 L324.1,628.8 L314.5,624.7 L302.4,618.9 L292.9,615.3 L285.8,608.4 L277.4,604.0 L271.1,602.3 L259.2,594.9 L249.4,589.5 L246.9,588.8 Z M395.5,624.9 L395.0,623.8 L395.5,624.9 Z"></path>
            <path [attr.data-dep]="'AYACUCHO'" [attr.fill]="colorFor('AYACUCHO')" (mousemove)="onPointerMove($event, 'AYACUCHO')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M274.7,463.9 L280.7,469.2 L288.6,466.5 L294.5,477.5 L298.4,481.7 L306.1,491.6 L309.0,499.6 L315.1,509.7 L312.8,512.1 L304.3,508.5 L297.2,502.0 L295.2,507.1 L295.8,520.0 L297.5,524.6 L301.0,531.0 L306.5,543.9 L306.6,555.2 L304.3,560.0 L310.7,562.9 L315.4,561.7 L320.3,559.5 L327.8,559.8 L328.3,562.9 L326.6,570.2 L321.9,579.0 L316.7,582.8 L311.1,587.2 L301.2,587.8 L295.2,584.3 L292.9,588.2 L284.6,594.5 L282.1,588.3 L275.3,586.9 L273.1,581.5 L266.8,577.3 L258.8,575.7 L261.4,565.7 L257.2,562.4 L253.7,554.5 L247.0,553.8 L244.4,549.5 L246.2,541.9 L251.9,537.3 L257.9,534.3 L258.8,527.2 L258.0,520.2 L254.9,513.9 L254.7,509.2 L263.3,505.9 L270.4,502.7 L273.1,496.6 L277.6,496.4 L275.3,489.2 L274.6,484.5 L272.0,476.0 L265.7,469.9 L273.0,464.6 L274.7,463.9 Z M297.8,582.1 L301.6,583.1 L297.8,582.1 Z"></path>
            <path [attr.data-dep]="'CAJAMARCA'" [attr.fill]="colorFor('CAJAMARCA')" (mousemove)="onPointerMove($event, 'CAJAMARCA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M84.4,267.1 L86.7,260.7 L88.6,254.5 L82.7,248.9 L80.6,245.2 L83.2,239.5 L86.3,233.5 L80.8,226.7 L81.4,218.3 L86.4,209.5 L83.0,200.7 L85.5,193.9 L94.0,188.5 L100.8,185.5 L101.2,178.7 L108.0,175.3 L112.0,181.0 L109.8,192.2 L108.8,199.9 L115.3,207.0 L108.9,216.7 L111.6,228.6 L118.2,234.2 L125.2,243.0 L130.9,252.4 L135.0,265.0 L141.4,278.0 L144.9,283.9 L135.0,292.1 L126.4,295.1 L122.4,292.8 L121.2,285.2 L111.1,287.1 L109.7,281.9 L101.1,284.6 L98.3,291.2 L94.3,284.2 L87.0,280.7 L86.0,276.6 L84.4,267.1 Z"></path>
            <path [attr.data-dep]="'CALLAO'" [attr.fill]="colorFor('CALLAO')" (mousemove)="onPointerMove($event, 'CALLAO')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M166.1,450.7 L168.7,455.6 L167.4,459.8 L166.1,450.7 Z"></path>
            <path [attr.data-dep]="'CUSCO'" [attr.fill]="colorFor('CUSCO')" (mousemove)="onPointerMove($event, 'CUSCO')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M346.3,559.0 L348.0,552.0 L352.2,550.5 L357.2,545.7 L362.2,538.6 L362.2,531.0 L355.5,522.4 L348.2,518.6 L339.2,515.1 L330.5,511.4 L325.5,511.8 L315.1,509.7 L309.0,499.6 L306.1,491.6 L298.4,481.7 L294.5,477.5 L288.6,466.5 L295.5,465.7 L301.8,471.7 L308.2,465.6 L310.5,459.8 L309.3,455.1 L304.2,447.1 L308.9,439.3 L313.5,430.9 L320.9,430.2 L327.3,429.1 L330.1,432.7 L337.3,433.6 L346.0,433.8 L355.2,432.2 L352.3,441.8 L349.4,450.6 L351.4,456.0 L354.1,459.3 L361.0,462.7 L365.4,469.5 L361.6,476.8 L366.0,482.3 L371.6,485.7 L379.6,484.0 L386.7,491.4 L393.4,494.4 L397.9,504.4 L405.6,499.7 L415.6,498.8 L423.0,501.6 L425.8,507.5 L423.5,512.6 L417.2,518.7 L412.7,523.7 L411.4,526.6 L407.9,534.7 L407.7,540.1 L405.9,546.2 L404.0,550.7 L398.2,559.2 L403.5,562.9 L402.4,570.8 L403.1,581.4 L401.1,587.4 L396.8,585.8 L396.4,579.9 L394.7,574.7 L388.3,574.9 L384.0,574.2 L380.1,576.7 L371.9,574.5 L372.1,567.9 L367.2,563.9 L364.8,557.9 L362.5,567.1 L354.7,564.4 L346.3,563.3 L346.3,559.0 Z M393.2,552.2 L393.1,550.5 L393.2,552.2 Z"></path>
            <path [attr.data-dep]="'HUANCAVELICA'" [attr.fill]="colorFor('HUANCAVELICA')" (mousemove)="onPointerMove($event, 'HUANCAVELICA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M247.4,538.6 L239.8,535.3 L233.1,530.4 L229.6,526.7 L231.1,520.3 L231.9,512.0 L227.3,510.8 L218.9,510.8 L222.7,502.6 L223.1,498.3 L225.4,492.3 L230.3,486.9 L227.5,481.8 L233.7,481.3 L241.4,474.9 L246.9,466.2 L247.9,457.7 L259.3,458.8 L264.0,456.7 L274.4,462.9 L273.2,467.5 L268.6,474.4 L274.9,481.5 L276.8,486.2 L275.4,492.7 L276.0,497.7 L272.3,498.1 L267.1,503.1 L261.2,509.4 L253.6,510.6 L257.3,516.4 L259.1,523.5 L257.9,531.0 L258.4,537.1 L248.6,536.4 L247.4,538.6 Z"></path>
            <path [attr.data-dep]="'HUANUCO'" [attr.fill]="colorFor('HUANUCO')" (mousemove)="onPointerMove($event, 'HUANUCO')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M161.1,324.6 L168.1,321.1 L171.3,325.5 L179.7,324.1 L190.7,323.8 L195.5,321.3 L200.8,326.4 L205.1,333.2 L208.1,317.2 L212.8,321.6 L213.5,331.7 L216.2,341.4 L219.3,349.8 L228.2,357.9 L237.1,353.9 L241.7,351.3 L242.7,345.7 L246.1,339.6 L252.2,339.9 L255.5,329.6 L267.0,326.7 L264.6,335.7 L262.0,346.1 L265.4,354.1 L260.1,360.5 L257.0,368.8 L253.6,370.7 L247.4,373.9 L240.5,372.6 L238.7,375.8 L231.5,379.8 L226.4,381.7 L222.8,388.7 L216.9,392.3 L212.4,399.1 L206.5,397.2 L199.6,396.3 L192.7,395.3 L183.7,399.3 L178.7,395.2 L180.5,384.0 L177.2,373.7 L173.7,371.2 L175.6,362.7 L179.2,352.6 L183.7,352.4 L174.0,345.0 L168.2,339.3 L163.3,329.1 L161.1,324.6 Z"></path>
            <path [attr.data-dep]="'ICA'" [attr.fill]="colorFor('ICA')" (mousemove)="onPointerMove($event, 'ICA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M258.8,575.7 L252.0,579.8 L247.8,588.5 L242.6,585.9 L241.4,580.8 L232.7,571.9 L227.7,566.9 L217.0,561.1 L212.4,553.8 L208.9,548.5 L206.0,542.4 L201.3,534.2 L196.3,530.2 L199.9,527.5 L204.3,517.1 L203.5,507.2 L213.8,495.1 L221.9,496.9 L225.6,497.6 L223.1,501.1 L219.5,508.6 L223.3,512.3 L230.4,509.4 L230.0,519.0 L229.0,525.3 L228.8,529.5 L240.8,533.9 L245.5,534.9 L248.1,544.3 L245.8,550.2 L247.4,557.5 L255.3,557.1 L259.0,563.2 L262.5,568.4 L258.8,575.7 Z"></path>
            <path [attr.data-dep]="'JUNIN'" [attr.fill]="colorFor('JUNIN')" (mousemove)="onPointerMove($event, 'JUNIN')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M266.0,415.7 L270.9,419.2 L280.2,419.8 L288.7,421.7 L293.0,420.4 L295.0,411.4 L302.8,413.1 L305.4,420.8 L308.5,430.6 L307.8,437.0 L302.9,444.2 L307.4,452.6 L310.9,458.0 L309.1,463.4 L303.5,471.6 L297.9,467.4 L290.8,465.8 L283.3,470.0 L275.6,466.0 L271.9,460.8 L262.7,457.1 L255.9,459.9 L246.8,459.5 L244.3,470.3 L239.0,475.1 L230.9,482.0 L227.8,478.8 L228.1,470.1 L223.1,458.9 L214.3,456.6 L209.5,453.1 L203.6,444.2 L200.5,441.6 L194.9,432.2 L191.6,423.4 L199.3,422.5 L202.2,421.3 L202.0,416.5 L204.7,420.7 L211.0,420.8 L207.9,415.4 L214.4,414.5 L219.6,412.3 L227.1,411.8 L232.1,410.8 L234.1,413.5 L240.3,410.1 L246.8,406.2 L251.3,408.8 L257.6,412.6 L263.1,413.9 L266.0,415.7 Z"></path>
            <path [attr.data-dep]="'LA LIBERTAD'" [attr.fill]="colorFor('LA LIBERTAD')" (mousemove)="onPointerMove($event, 'LA LIBERTAD')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M110.3,341.4 L106.8,331.5 L99.3,321.0 L97.3,312.4 L85.0,301.5 L79.0,293.3 L76.1,286.0 L73.5,276.3 L79.4,264.1 L85.1,271.7 L83.5,279.0 L89.6,281.2 L95.2,289.0 L98.9,289.0 L102.8,282.8 L110.9,283.1 L116.2,287.3 L121.4,288.0 L123.4,292.7 L130.6,291.1 L139.9,288.5 L143.7,282.1 L139.5,274.6 L137.8,265.6 L144.2,264.7 L150.1,274.5 L148.9,279.8 L152.7,288.4 L154.9,296.8 L158.8,300.8 L162.0,306.6 L168.7,305.3 L176.8,310.9 L176.5,316.8 L168.1,321.1 L161.1,324.6 L155.7,317.2 L148.9,308.4 L142.2,306.9 L134.3,312.9 L129.7,320.7 L127.6,327.3 L117.9,332.5 L112.5,337.2 L110.3,341.4 Z"></path>
            <path [attr.data-dep]="'LAMBAYEQUE'" [attr.fill]="colorFor('LAMBAYEQUE')" (mousemove)="onPointerMove($event, 'LAMBAYEQUE')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M34.6,242.1 L50.9,223.8 L59.7,211.9 L64.1,210.0 L66.7,214.4 L70.7,222.0 L73.8,225.6 L86.7,228.0 L87.1,236.5 L80.6,239.7 L80.3,246.2 L85.4,253.7 L91.4,254.7 L84.9,262.3 L81.4,264.5 L70.4,272.9 L61.1,261.3 L55.7,253.7 L34.6,242.1 Z"></path>
            <path [attr.data-dep]="'LIMA'" [attr.fill]="colorFor('LIMA')" (mousemove)="onPointerMove($event, 'LIMA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M176.8,391.3 L182.0,398.5 L186.4,405.5 L189.2,413.9 L191.1,420.4 L192.6,426.2 L196.9,436.0 L202.9,440.5 L203.7,446.8 L209.4,455.3 L218.2,457.8 L225.3,461.6 L228.4,474.7 L227.5,481.8 L230.3,486.9 L225.4,492.3 L221.9,496.9 L213.8,495.1 L203.5,507.2 L192.7,496.7 L191.2,489.3 L182.9,477.8 L181.7,472.3 L171.8,465.0 L170.0,458.6 L168.4,450.4 L165.0,443.4 L159.0,436.3 L148.7,427.2 L147.9,419.5 L144.8,411.2 L141.4,402.5 L142.8,399.3 L146.7,393.0 L145.1,402.3 L151.2,403.1 L154.3,409.3 L161.3,402.5 L166.5,398.5 L172.3,393.3 L176.8,391.3 Z"></path>
            <path [attr.data-dep]="'LORETO'" [attr.fill]="colorFor('LORETO')" (mousemove)="onPointerMove($event, 'LORETO')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M288.5,286.5 L282.6,281.3 L275.8,279.5 L267.4,277.4 L263.3,285.2 L265.6,292.8 L266.1,297.3 L258.4,305.7 L248.4,302.4 L241.5,309.2 L235.3,309.6 L230.4,315.4 L232.8,321.0 L224.9,320.0 L219.9,323.2 L215.6,329.6 L212.7,327.0 L212.0,316.6 L213.7,311.4 L217.4,306.6 L212.7,302.8 L207.9,287.5 L203.9,278.9 L206.0,273.9 L211.0,266.0 L209.5,258.9 L220.3,260.5 L225.5,260.1 L230.5,252.4 L230.9,238.1 L229.3,231.5 L225.6,231.0 L218.5,231.7 L212.8,231.5 L202.9,234.2 L197.2,226.9 L187.0,228.0 L180.2,222.6 L174.7,216.6 L164.3,212.4 L157.6,212.2 L151.9,205.9 L146.6,205.4 L144.9,197.8 L141.8,192.8 L144.2,186.2 L143.7,178.9 L150.8,169.6 L152.2,155.6 L151.4,146.6 L149.6,137.4 L143.5,120.4 L187.3,97.5 L229.1,55.2 L237.4,35.8 L239.3,26.6 L239.0,17.6 L232.0,10.7 L226.3,5.8 L230.3,3.0 L239.7,3.4 L249.0,4.1 L255.5,7.5 L260.0,9.7 L265.9,13.6 L273.9,21.9 L277.3,32.9 L281.5,37.0 L287.3,40.1 L293.4,45.6 L302.7,48.8 L307.8,56.7 L307.0,64.7 L311.5,66.4 L320.3,69.5 L322.5,76.6 L321.6,85.9 L327.5,88.1 L331.8,91.6 L341.6,89.0 L349.8,92.4 L354.5,91.5 L362.5,87.8 L367.2,86.7 L372.0,82.8 L377.2,82.7 L388.4,89.9 L393.7,87.9 L400.5,85.3 L407.2,83.4 L412.1,87.5 L416.4,92.8 L424.1,94.9 L430.3,95.9 L436.8,100.1 L435.4,109.0 L417.1,145.3 L427.6,143.8 L433.2,148.0 L438.5,154.7 L442.7,162.1 L438.1,163.7 L434.9,163.6 L430.1,160.2 L423.0,158.1 L417.2,158.8 L412.2,157.6 L407.7,161.2 L399.7,166.5 L394.4,165.8 L387.7,167.7 L382.1,169.1 L377.8,170.6 L369.5,171.6 L362.9,175.8 L354.1,181.9 L348.5,185.8 L341.2,190.7 L335.3,193.2 L331.2,200.7 L327.7,207.4 L327.7,214.7 L319.0,226.0 L316.6,233.0 L320.4,247.5 L311.1,252.4 L303.1,255.9 L297.0,268.5 L299.6,277.5 L293.2,280.9 L291.3,284.3 L288.5,286.5 Z"></path>
            <path [attr.data-dep]="'MADRE DE DIOS'" [attr.fill]="colorFor('MADRE DE DIOS')" (mousemove)="onPointerMove($event, 'MADRE DE DIOS')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M425.9,502.8 L418.3,499.4 L408.6,498.0 L401.0,505.7 L396.0,494.8 L389.0,491.0 L381.5,484.3 L374.0,487.7 L365.2,483.4 L363.1,477.3 L365.3,472.5 L360.3,466.3 L357.7,459.5 L353.5,456.3 L351.6,451.7 L348.0,446.1 L354.9,433.7 L356.7,426.9 L357.4,419.4 L363.7,418.6 L382.2,417.2 L392.7,410.8 L395.1,402.9 L403.8,395.4 L407.2,391.6 L413.7,386.0 L415.3,379.7 L417.3,419.0 L424.6,420.5 L433.2,421.1 L439.7,418.2 L448.9,416.3 L456.2,416.8 L475.1,445.1 L490.8,479.5 L488.9,484.9 L483.9,491.1 L454.3,508.5 L425.4,499.8 L425.9,502.8 Z"></path>
            <path [attr.data-dep]="'MOQUEGUA'" [attr.fill]="colorFor('MOQUEGUA')" (mousemove)="onPointerMove($event, 'MOQUEGUA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M397.2,679.8 L389.5,672.7 L387.5,663.2 L391.0,651.9 L385.7,643.2 L388.4,637.6 L391.9,633.7 L397.2,628.3 L404.4,627.8 L404.2,621.9 L408.0,612.3 L411.4,610.8 L419.4,609.7 L425.4,615.8 L426.2,624.8 L432.1,629.5 L437.4,635.2 L441.0,638.0 L437.2,644.2 L430.9,644.6 L423.9,642.3 L422.0,651.9 L414.6,657.0 L412.7,663.7 L402.8,674.3 L397.2,679.8 Z"></path>
            <path [attr.data-dep]="'PASCO'" [attr.fill]="colorFor('PASCO')" (mousemove)="onPointerMove($event, 'PASCO')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M200.8,416.1 L199.7,424.1 L192.7,422.4 L189.8,417.7 L186.2,407.1 L183.7,399.3 L192.7,395.3 L199.6,396.3 L206.5,397.2 L212.4,399.1 L216.9,392.3 L222.8,388.7 L226.4,381.7 L231.5,379.8 L238.7,375.8 L240.5,372.6 L247.4,373.9 L253.6,370.7 L257.0,368.8 L260.1,360.5 L265.9,364.4 L270.8,372.4 L271.7,380.4 L275.4,385.0 L279.3,391.5 L279.5,398.1 L281.6,405.2 L275.8,408.6 L269.4,412.8 L264.4,415.4 L258.8,412.3 L253.7,410.2 L249.0,406.7 L242.4,408.1 L237.5,413.8 L231.3,413.3 L227.7,409.3 L221.7,411.7 L216.9,414.0 L209.7,414.4 L204.1,417.5 L201.9,416.1 L200.8,416.1 Z"></path>
            <path [attr.data-dep]="'PIURA'" [attr.fill]="colorFor('PIURA')" (mousemove)="onPointerMove($event, 'PIURA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M88.7,188.3 L82.3,196.9 L84.2,201.7 L81.5,210.2 L81.9,219.9 L77.7,224.6 L72.6,221.3 L69.3,217.9 L63.7,211.2 L60.6,209.3 L53.5,223.6 L44.2,228.1 L23.6,235.2 L14.6,223.6 L19.5,221.4 L25.6,218.3 L21.9,205.8 L15.0,199.7 L16.8,192.8 L13.6,184.1 L9.5,171.5 L10.8,165.0 L13.9,159.5 L21.4,156.3 L27.8,158.2 L37.1,158.1 L41.4,156.2 L46.0,160.0 L41.2,166.2 L47.5,168.0 L54.6,162.5 L63.5,167.2 L69.7,169.4 L75.2,171.1 L78.1,175.4 L86.7,188.5 L88.7,188.3 Z"></path>
            <path [attr.data-dep]="'PUNO'" [attr.fill]="colorFor('PUNO')" (mousemove)="onPointerMove($event, 'PUNO')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M482.1,625.6 L486.1,623.4 L482.1,625.6 Z M454.5,659.3 L448.9,657.4 L439.0,650.5 L437.2,644.2 L441.0,638.0 L437.4,635.2 L432.1,629.5 L426.2,624.8 L425.4,615.8 L419.4,609.7 L411.4,610.8 L405.0,601.9 L402.3,593.5 L401.1,587.4 L403.1,581.4 L402.4,570.8 L403.5,562.9 L398.2,559.2 L404.0,550.7 L405.9,546.2 L407.7,540.1 L407.9,534.7 L411.4,526.6 L412.7,523.7 L417.2,518.7 L423.5,512.6 L425.8,507.5 L425.4,499.8 L454.3,508.5 L484.6,497.8 L482.2,514.1 L476.5,521.8 L482.2,526.6 L479.9,532.8 L484.5,539.9 L478.4,545.7 L475.8,551.0 L470.6,555.9 L470.4,562.0 L465.9,567.4 L468.1,575.5 L470.8,584.0 L467.9,588.6 L460.8,588.2 L454.5,584.1 L451.2,581.0 L444.8,583.2 L443.8,589.3 L450.3,599.8 L446.7,596.4 L440.1,598.3 L442.2,604.4 L449.7,603.7 L453.3,608.5 L462.8,611.9 L462.7,617.0 L473.5,619.8 L477.1,620.9 L475.8,627.8 L477.8,633.3 L472.5,637.9 L465.9,647.9 L461.9,652.1 L454.5,659.3 Z M445.1,579.8 L440.0,577.8 L438.5,579.3 L445.1,579.8 Z"></path>
            <path [attr.data-dep]="'SAN MARTIN'" [attr.fill]="colorFor('SAN MARTIN')" (mousemove)="onPointerMove($event, 'SAN MARTIN')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M212.0,316.6 L207.0,329.5 L201.2,329.4 L198.7,320.7 L193.6,326.1 L184.8,324.7 L176.4,326.1 L169.8,322.8 L174.1,319.5 L176.1,312.7 L172.5,306.3 L164.1,304.8 L157.7,304.0 L156.3,297.2 L154.7,292.9 L149.9,282.7 L148.5,275.3 L145.9,270.2 L144.1,258.8 L146.7,253.8 L158.6,254.5 L160.4,247.8 L162.3,240.5 L166.7,242.4 L164.7,233.5 L158.1,229.4 L152.8,230.3 L148.3,225.4 L143.6,215.8 L143.8,206.4 L147.6,205.3 L153.4,207.5 L159.1,211.4 L171.6,215.4 L177.5,218.3 L182.9,226.1 L190.5,228.7 L199.3,231.2 L206.6,234.6 L214.1,233.1 L222.3,233.2 L226.2,228.8 L229.6,234.2 L228.6,241.2 L230.5,257.2 L224.1,259.5 L217.4,258.4 L211.0,262.0 L211.0,269.1 L205.1,276.3 L203.2,281.6 L207.6,293.7 L216.8,301.3 L214.6,307.1 L214.8,314.1 L212.0,316.6 Z"></path>
            <path [attr.data-dep]="'TACNA'" [attr.fill]="colorFor('TACNA')" (mousemove)="onPointerMove($event, 'TACNA')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M454.5,659.3 L461.1,667.6 L447.6,674.6 L450.5,684.4 L446.4,692.9 L435.1,698.8 L422.4,697.0 L407.2,687.1 L398.9,681.5 L402.8,674.3 L412.7,663.7 L414.6,657.0 L422.0,651.9 L423.9,642.3 L430.9,644.6 L437.0,648.6 L446.5,657.7 L452.5,658.9 L454.5,659.3 Z"></path>
            <path [attr.data-dep]="'TUMBES'" [attr.fill]="colorFor('TUMBES')" (mousemove)="onPointerMove($event, 'TUMBES')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M39.9,154.6 L34.7,160.3 L24.8,158.8 L18.7,154.8 L26.7,146.7 L36.3,137.5 L42.0,131.9 L50.1,130.2 L51.3,136.1 L52.5,146.5 L47.1,152.1 L39.9,154.6 Z"></path>
            <path [attr.data-dep]="'UCAYALI'" [attr.fill]="colorFor('UCAYALI')" (mousemove)="onPointerMove($event, 'UCAYALI')" (mouseleave)="onPointerLeave()" class="stroke-white stroke-[1.2] transition-colors duration-150 cursor-pointer" d="M417.3,377.6 L415.9,383.9 L409.5,390.6 L403.9,393.8 L397.7,400.1 L394.1,409.9 L388.9,417.2 L370.6,419.0 L359.4,418.6 L359.7,423.1 L355.2,432.2 L346.0,433.8 L337.3,433.6 L330.1,432.7 L327.3,429.1 L320.9,430.2 L313.5,430.9 L308.5,430.6 L305.4,420.8 L302.8,413.1 L295.0,411.4 L293.0,420.4 L288.7,421.7 L280.2,419.8 L270.9,419.2 L266.0,415.7 L273.1,411.8 L277.1,406.6 L282.8,403.9 L278.1,398.1 L279.0,387.9 L273.9,385.1 L272.0,377.0 L269.3,369.4 L265.5,361.5 L265.4,354.1 L262.0,346.1 L264.6,335.7 L267.0,326.7 L255.5,329.6 L252.2,339.9 L246.1,339.6 L242.7,345.7 L241.7,351.3 L237.1,353.9 L228.2,357.9 L219.3,349.8 L216.2,341.4 L213.5,331.7 L219.9,325.3 L222.6,321.1 L228.8,322.2 L230.4,317.7 L233.2,310.7 L240.3,310.3 L244.2,303.5 L253.6,307.4 L263.9,302.0 L266.6,294.7 L263.3,287.6 L265.7,281.8 L270.2,277.5 L281.0,279.8 L286.6,284.6 L291.7,290.5 L298.8,294.5 L296.8,300.9 L301.6,304.6 L304.6,313.7 L311.9,322.4 L313.9,327.7 L321.8,334.4 L326.1,339.4 L327.5,348.1 L318.9,356.4 L344.1,361.0 L353.3,365.6 L356.1,372.3 L358.6,377.2 L374.4,380.8 L391.2,380.5 L400.6,373.7 L405.5,370.9 L412.1,364.3 L421.2,361.4 L417.9,365.8 L420.3,371.8 L417.3,377.6 Z"></path>
          </g>
        </svg>

        <!-- Tooltip flotante con flecha, sigue al mouse mientras está sobre un departamento -->
        @if (hoverDep(); as dep) {
          <div
            class="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full"
            [style.left.px]="hoverPos()?.x || 0"
            [style.top.px]="(hoverPos()?.y || 0) - 10"
          >
            <div class="rounded-lg bg-[#0d3393] text-white text-xs font-semibold px-3 py-2 shadow-lg whitespace-nowrap">
              {{ dep | titlecase }}: <span class="font-extrabold">{{ counts()[dep] || 0 }}</span> {{ unitLabel() }}
            </div>
            <!-- Flecha apuntando hacia el departamento -->
            <div class="w-0 h-0 mx-auto border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[7px] border-t-[#0d3393]"></div>
          </div>
        }
      </div>

      <!-- Leyenda de intensidad -->
      <div class="flex items-center justify-center gap-2 mt-3 text-[10px] text-slate-400 font-medium">
        <span>Menos</span>
        <div class="flex h-2.5 w-24 rounded-full overflow-hidden">
          <div class="flex-1 bg-[#dbeafe]"></div>
          <div class="flex-1 bg-[#93c5fd]"></div>
          <div class="flex-1 bg-[#3b82f6]"></div>
          <div class="flex-1 bg-[#1d4ed8]"></div>
          <div class="flex-1 bg-[#1e3a8a]"></div>
        </div>
        <span>Más</span>
      </div>

      <!-- Lista compacta: solo departamentos con datos, ordenados de mayor a menor -->
      @if (departamentosConDatos().length) {
        <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          @for (d of departamentosConDatos(); track d.nombre) {
            <div class="flex items-center gap-1.5 text-xs">
              <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="colorFor(d.nombre)"></span>
              <span class="truncate text-slate-600 font-medium">{{ d.nombre | titlecase }}</span>
              <span class="ml-auto font-bold text-slate-900">{{ d.valor }}</span>
            </div>
          }
        </div>
      } @else {
        <p class="text-center text-xs text-slate-400 mt-4">Sin datos de ubicación todavía.</p>
      }
    </div>
  `
})
export class PeruMapComponent {
  counts = input<Record<string, number>>({});
  title = input<string>('Clientes por departamento');
  unitLabel = input<string>('clientes');

  private mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  protected hoverDep = signal<string | null>(null);
  protected hoverPos = signal<{ x: number; y: number } | null>(null);

  private maxValor = computed(() => {
    const valores = Object.values(this.counts());
    return valores.length ? Math.max(...valores) : 0;
  });

  protected departamentosConDatos = computed(() => {
    return Object.entries(this.counts())
      .filter(([, valor]) => valor > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, valor]) => ({ nombre, valor }));
  });

  protected colorFor(departamento: string): string {
    const valor = this.counts()[departamento] || 0;
    const max = this.maxValor();
    if (!valor || !max) return '#e2e8f0'; // slate-200: sin datos

    const t = valor / max; // 0..1
    if (t <= 0.2) return '#dbeafe';
    if (t <= 0.4) return '#93c5fd';
    if (t <= 0.65) return '#3b82f6';
    if (t <= 0.85) return '#1d4ed8';
    return '#1e3a8a';
  }

  // Posición relativa al contenedor (no al viewport) para que el tooltip
  // quede anclado sobre el departamento aunque la página tenga scroll o el
  // mapa esté reescalado por el viewBox responsive.
  protected onPointerMove(event: MouseEvent, departamento: string) {
    const rect = this.mapContainer()?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.hoverDep.set(departamento);
    this.hoverPos.set({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  protected onPointerLeave() {
    this.hoverDep.set(null);
    this.hoverPos.set(null);
  }
}
